//! Repositório de alunos.

use super::normalize::{like_tokens, normalize};
use super::types::{Page, Ref};
use super::{Filter, clean_opt, date_lit, map_write_err, paging, require, text};
use crate::error::{AppError, AppResult};
use chrono::NaiveDate;
use rusqlite::types::Value;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};

/// Turma do aluno com o professor responsável (`Ref & { teacher: Ref }`).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentClass {
    pub id: i64,
    pub name: String,
    pub teacher: Ref,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Student {
    pub id: i64,
    pub name: String,
    pub registration: String,
    pub class_room: StudentClass,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub guardian: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub active_loans: i64,
    pub overdue_loans: i64,
    pub read_count: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StudentInput {
    pub name: String,
    pub registration: String,
    pub class_id: i64,
    #[serde(default)]
    pub guardian: Option<String>,
    #[serde(default)]
    pub contact: Option<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct StudentQuery {
    pub text: Option<String>,
    pub class_id: Option<i64>,
    pub overdue_only: Option<bool>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

const FROM: &str = " FROM students s
     JOIN classes c ON c.id = s.class_id
     JOIN teachers t ON t.id = c.teacher_id";

fn select(today: NaiveDate) -> String {
    let today = date_lit(today);
    let read_key = super::loans::READ_KEY;
    let created = super::utc_iso("s.created_at");
    format!(
        "SELECT s.id, s.name, s.registration, s.class_id, c.name, c.teacher_id, t.name,
            s.guardian, s.contact, s.notes,
            (SELECT COUNT(*) FROM loans l WHERE l.student_id = s.id AND l.returned_at IS NULL),
            (SELECT COUNT(*) FROM loans l WHERE l.student_id = s.id AND l.returned_at IS NULL
                AND l.due_at < {today}),
            (SELECT COUNT(DISTINCT {read_key}) FROM loans l WHERE l.student_id = s.id AND l.returned_at IS NOT NULL
                AND l.marked_read = 1),
            {created}
         {FROM}"
    )
}

fn map_student(row: &rusqlite::Row<'_>) -> rusqlite::Result<Student> {
    Ok(Student {
        id: row.get(0)?,
        name: row.get(1)?,
        registration: row.get(2)?,
        class_room: StudentClass {
            id: row.get(3)?,
            name: row.get(4)?,
            teacher: Ref {
                id: row.get(5)?,
                name: row.get(6)?,
            },
        },
        guardian: row.get(7)?,
        contact: row.get(8)?,
        notes: row.get(9)?,
        active_loans: row.get(10)?,
        overdue_loans: row.get(11)?,
        read_count: row.get(12)?,
        created_at: row.get(13)?,
    })
}

pub fn get(conn: &Connection, id: i64, today: NaiveDate) -> AppResult<Student> {
    conn.query_row(
        &format!("{} WHERE s.id = ?1", select(today)),
        [id],
        map_student,
    )
    .optional()?
    .ok_or_else(|| AppError::not_found("Aluno não encontrado."))
}

/// Todos os alunos da turma, por nome.
pub fn list_by_class(
    conn: &Connection,
    class_id: i64,
    today: NaiveDate,
) -> AppResult<Vec<Student>> {
    let mut stmt = conn.prepare(&format!(
        "{} WHERE s.class_id = ?1 ORDER BY s.name_norm, s.id",
        select(today)
    ))?;
    let rows = stmt.query_map([class_id], map_student)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// Lista paginada (busca por nome, matrícula ou turma; filtro por turma; só com atraso).
pub fn list(conn: &Connection, query: &StudentQuery, today: NaiveDate) -> AppResult<Page<Student>> {
    let mut filter = Filter::new();
    if let Some(q) = query.text.as_deref() {
        for token in like_tokens(q) {
            filter.push(
                "(s.name_norm LIKE ? ESCAPE '\\' OR libok_norm(s.registration) LIKE ? ESCAPE '\\'
                  OR c.name_norm LIKE ? ESCAPE '\\')",
                vec![text(&token); 3],
            );
        }
    }
    if let Some(class_id) = query.class_id {
        filter.push("s.class_id = ?", vec![Value::Integer(class_id)]);
    }
    if query.overdue_only.unwrap_or(false) {
        filter.push(
            format!(
                "EXISTS (SELECT 1 FROM loans l WHERE l.student_id = s.id
                         AND l.returned_at IS NULL AND l.due_at < {})",
                date_lit(today)
            ),
            vec![],
        );
    }
    let where_sql = filter.where_sql();
    let count_values = filter.params_with(vec![]);
    let total: i64 = conn.query_row(
        &format!("SELECT COUNT(*){FROM}{where_sql}"),
        params_from_iter(count_values.iter()),
        |r| r.get(0),
    )?;
    let (page, page_size, offset) = paging(query.page, query.page_size);
    let values = filter.params_with(vec![Value::Integer(page_size), Value::Integer(offset)]);
    let mut stmt = conn.prepare(&format!(
        "{}{where_sql} ORDER BY s.name_norm, s.id LIMIT ? OFFSET ?",
        select(today)
    ))?;
    let items = stmt
        .query_map(params_from_iter(values.iter()), map_student)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Page {
        items,
        total,
        page,
        page_size,
    })
}

struct Clean {
    name: String,
    registration: String,
}

fn clean(conn: &Connection, input: &StudentInput, except_id: Option<i64>) -> AppResult<Clean> {
    let name = require("name", "o nome do aluno", &input.name)?;
    let registration = require("registration", "a matrícula", &input.registration)?;
    let class_ok: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM classes WHERE id = ?1)",
        [input.class_id],
        |r| r.get(0),
    )?;
    if !class_ok {
        return Err(AppError::validation("classId", "Selecione a turma."));
    }
    let dup: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM students WHERE lower(registration) = lower(?1) AND id IS NOT ?2)",
        params![registration, except_id],
        |r| r.get(0),
    )?;
    if dup {
        return Err(AppError::duplicate_registration(format!(
            "A matrícula {registration} já está cadastrada."
        )));
    }
    Ok(Clean { name, registration })
}

pub fn create(conn: &Connection, input: &StudentInput, today: NaiveDate) -> AppResult<Student> {
    let c = clean(conn, input, None)?;
    conn.execute(
        "INSERT INTO students (name, name_norm, registration, class_id, guardian, contact, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            c.name,
            normalize(&c.name),
            c.registration,
            input.class_id,
            clean_opt(input.guardian.as_deref()),
            clean_opt(input.contact.as_deref()),
            clean_opt(input.notes.as_deref())
        ],
    )
    .map_err(map_write_err)?;
    get(conn, conn.last_insert_rowid(), today)
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: &StudentInput,
    today: NaiveDate,
) -> AppResult<Student> {
    get(conn, id, today)?;
    let c = clean(conn, input, Some(id))?;
    conn.execute(
        "UPDATE students SET name = ?1, name_norm = ?2, registration = ?3, class_id = ?4,
             guardian = ?5, contact = ?6, notes = ?7
         WHERE id = ?8",
        params![
            c.name,
            normalize(&c.name),
            c.registration,
            input.class_id,
            clean_opt(input.guardian.as_deref()),
            clean_opt(input.contact.as_deref()),
            clean_opt(input.notes.as_deref()),
            id
        ],
    )
    .map_err(map_write_err)?;
    get(conn, id, today)
}

/// Exclui o aluno e seu histórico; bloqueado com empréstimo ativo.
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    let exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM students WHERE id = ?1)",
        [id],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(AppError::not_found("Aluno não encontrado."));
    }
    let active: i64 = tx.query_row(
        "SELECT COUNT(*) FROM loans WHERE student_id = ?1 AND returned_at IS NULL",
        [id],
        |r| r.get(0),
    )?;
    if active > 0 {
        return Err(AppError::has_active_loans(
            "Este aluno tem empréstimos ativos; registre as devoluções antes de excluir.",
        ));
    }
    tx.execute("DELETE FROM students WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::loans::{self, LoanInput};
    use crate::db::testutil::{book, class, db, school, student, today};
    use crate::db::types::ReaderKind;
    use crate::error::ErrorCode;

    fn input(name: &str, reg: &str, class_id: i64) -> StudentInput {
        StudentInput {
            name: name.into(),
            registration: reg.into(),
            class_id,
            guardian: Some(" Mãe ".into()),
            contact: None,
            notes: Some("".into()),
        }
    }

    fn lend(conn: &Connection, code: &str, student: i64, due: &str) -> i64 {
        let copy_id: i64 = conn
            .query_row(
                "SELECT id FROM copies WHERE registration_code = ?1",
                [code],
                |r| r.get(0),
            )
            .unwrap();
        loans::create(
            conn,
            &LoanInput {
                copy_id,
                reader_kind: ReaderKind::Student,
                reader_id: student,
                loaned_at: "2026-09-01".into(),
                due_at: due.into(),
            },
            today(),
        )
        .unwrap()
        .id
    }

    #[test]
    fn cria_com_campos_opcionais_limpos() {
        let conn = db();
        let (_, c, _) = school(&conn);
        let s = create(&conn, &input("  Ana Lúcia ", " 77 ", c), today()).unwrap();
        assert_eq!(s.name, "Ana Lúcia");
        assert_eq!(s.registration, "77");
        assert_eq!(s.guardian.as_deref(), Some("Mãe"));
        assert_eq!(s.notes, None);
        assert_eq!(s.class_room.name, "5º ano A");
        assert_eq!(s.class_room.teacher.name, "Profa. Marta");
    }

    #[test]
    fn matricula_duplicada() {
        let conn = db();
        let (_, c, s) = school(&conn);
        let err = create(&conn, &input("Outro", "2026001", c), today()).unwrap_err();
        assert_eq!(err.code, ErrorCode::DuplicateRegistration);
        // atualizar mantendo a própria matrícula é permitido
        assert!(update(&conn, s, &input("João S.", "2026001", c), today()).is_ok());
        let s2 = student(&conn, "Maria", "2026002", c);
        let err = update(&conn, s2, &input("Maria", "2026001", c), today()).unwrap_err();
        assert_eq!(err.code, ErrorCode::DuplicateRegistration);
    }

    #[test]
    fn valida_obrigatorios_e_turma() {
        let conn = db();
        let (_, c, _) = school(&conn);
        assert_eq!(
            create(&conn, &input("", "1", c), today())
                .unwrap_err()
                .field
                .as_deref(),
            Some("name")
        );
        assert_eq!(
            create(&conn, &input("A", " ", c), today())
                .unwrap_err()
                .field
                .as_deref(),
            Some("registration")
        );
        assert_eq!(
            create(&conn, &input("A", "1", 999), today())
                .unwrap_err()
                .field
                .as_deref(),
            Some("classId")
        );
    }

    #[test]
    fn busca_filtro_de_turma_paginacao_e_atraso() {
        let conn = db();
        let (t, _c, s1) = school(&conn);
        let c2 = class(&conn, "6º ano B", t);
        let s2 = student(&conn, "Álvaro Pinto", "900", c2);
        book(&conn, "L1", &["A1"]);
        book(&conn, "L2", &["A2"]);
        lend(&conn, "A1", s1, "2026-10-01"); // atrasado (hoje = 2026-10-12)
        lend(&conn, "A2", s2, "2026-10-30");

        let q = |f: &dyn Fn(&mut StudentQuery)| {
            let mut q = StudentQuery::default();
            f(&mut q);
            list(&conn, &q, today()).unwrap()
        };
        assert_eq!(q(&|_| {}).total, 2);
        assert_eq!(q(&|q| q.text = Some("alvaro".into())).total, 1);
        assert_eq!(q(&|q| q.text = Some("2026001".into())).total, 1);
        assert_eq!(q(&|q| q.class_id = Some(c2)).items[0].name, "Álvaro Pinto");
        let late = q(&|q| q.overdue_only = Some(true));
        assert_eq!(late.total, 1);
        assert_eq!(
            (late.items[0].active_loans, late.items[0].overdue_loans),
            (1, 1)
        );
        let p = q(&|q| {
            q.page = Some(2);
            q.page_size = Some(1);
        });
        assert_eq!((p.total, p.items.len(), p.page), (2, 1, 2));
    }

    #[test]
    fn exclusao_bloqueada_com_emprestimo_ativo() {
        let conn = db();
        let (_, _, s) = school(&conn);
        book(&conn, "L1", &["A1"]);
        let loan = lend(&conn, "A1", s, "2026-10-30");
        assert_eq!(
            delete(&conn, s).unwrap_err().code,
            ErrorCode::HasActiveLoans
        );
        loans::return_loan(&conn, loan, "2026-10-02", false, today()).unwrap();
        delete(&conn, s).unwrap();
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM loans", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0, "histórico apagado junto");
        assert_eq!(delete(&conn, s).unwrap_err().code, ErrorCode::NotFound);
    }
}
