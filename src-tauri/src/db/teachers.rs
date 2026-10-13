//! Repositório de professores.

use super::normalize::{like_tokens, normalize};
use super::types::Ref;
use super::{Filter, clean_opt, date_lit, map_write_err, require, text};
use crate::error::{AppError, AppResult};
use chrono::NaiveDate;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Teacher {
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact: Option<String>,
    pub classes: Vec<Ref>,
    pub active_loans: i64,
    pub overdue_loans: i64,
    pub read_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeacherInput {
    pub name: String,
    #[serde(default)]
    pub contact: Option<String>,
}

fn select(today: NaiveDate) -> String {
    let today = date_lit(today);
    let read_key = super::loans::READ_KEY;
    format!(
        "SELECT t.id, t.name, t.contact,
            (SELECT COUNT(*) FROM loans l WHERE l.teacher_id = t.id AND l.returned_at IS NULL),
            (SELECT COUNT(*) FROM loans l WHERE l.teacher_id = t.id AND l.returned_at IS NULL
                AND l.due_at < {today}),
            (SELECT COUNT(DISTINCT {read_key}) FROM loans l WHERE l.teacher_id = t.id AND l.returned_at IS NOT NULL
                AND l.marked_read = 1)
         FROM teachers t"
    )
}

fn map_teacher(row: &rusqlite::Row<'_>) -> rusqlite::Result<Teacher> {
    Ok(Teacher {
        id: row.get(0)?,
        name: row.get(1)?,
        contact: row.get(2)?,
        classes: Vec::new(),
        active_loans: row.get(3)?,
        overdue_loans: row.get(4)?,
        read_count: row.get(5)?,
    })
}

fn fill_classes(conn: &Connection, teacher: &mut Teacher) -> AppResult<()> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, name FROM classes WHERE teacher_id = ?1 ORDER BY school_year DESC, name_norm",
    )?;
    teacher.classes = stmt
        .query_map([teacher.id], |r| {
            Ok(Ref {
                id: r.get(0)?,
                name: r.get(1)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(())
}

pub fn get(conn: &Connection, id: i64, today: NaiveDate) -> AppResult<Teacher> {
    let mut t = conn
        .query_row(
            &format!("{} WHERE t.id = ?1", select(today)),
            [id],
            map_teacher,
        )
        .optional()?
        .ok_or_else(|| AppError::not_found("Professor não encontrado."))?;
    fill_classes(conn, &mut t)?;
    Ok(t)
}

/// Lista professores por nome (busca opcional sem acento).
pub fn list(
    conn: &Connection,
    text_query: Option<&str>,
    today: NaiveDate,
) -> AppResult<Vec<Teacher>> {
    let mut filter = Filter::new();
    if let Some(q) = text_query {
        for token in like_tokens(q) {
            filter.push("t.name_norm LIKE ? ESCAPE '\\'", vec![text(&token)]);
        }
    }
    let sql = format!(
        "{}{} ORDER BY t.name_norm, t.id",
        select(today),
        filter.where_sql()
    );
    let values = filter.params_with(vec![]);
    let mut stmt = conn.prepare(&sql)?;
    let mut teachers = stmt
        .query_map(params_from_iter(values.iter()), map_teacher)?
        .collect::<Result<Vec<_>, _>>()?;
    for t in &mut teachers {
        fill_classes(conn, t)?;
    }
    Ok(teachers)
}

pub fn create(conn: &Connection, input: &TeacherInput, today: NaiveDate) -> AppResult<Teacher> {
    let name = require("name", "o nome do professor", &input.name)?;
    conn.execute(
        "INSERT INTO teachers (name, name_norm, contact) VALUES (?1, ?2, ?3)",
        params![name, normalize(&name), clean_opt(input.contact.as_deref())],
    )
    .map_err(map_write_err)?;
    get(conn, conn.last_insert_rowid(), today)
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: &TeacherInput,
    today: NaiveDate,
) -> AppResult<Teacher> {
    get(conn, id, today)?;
    let name = require("name", "o nome do professor", &input.name)?;
    conn.execute(
        "UPDATE teachers SET name = ?1, name_norm = ?2, contact = ?3 WHERE id = ?4",
        params![
            name,
            normalize(&name),
            clean_opt(input.contact.as_deref()),
            id
        ],
    )
    .map_err(map_write_err)?;
    get(conn, id, today)
}

/// Exclui o professor. Bloqueado se for responsável por turma (`IN_USE`) ou se
/// tiver empréstimo ativo (`HAS_ACTIVE_LOANS`); caso contrário apaga o histórico junto.
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM teachers WHERE id = ?1)",
        [id],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(AppError::not_found("Professor não encontrado."));
    }
    let tx = conn.unchecked_transaction()?;
    let classes: i64 = tx.query_row(
        "SELECT COUNT(*) FROM classes WHERE teacher_id = ?1",
        [id],
        |r| r.get(0),
    )?;
    if classes > 0 {
        return Err(AppError::in_use(
            "Este professor é responsável por turmas; troque o responsável antes de excluir.",
        ));
    }
    let active: i64 = tx.query_row(
        "SELECT COUNT(*) FROM loans WHERE teacher_id = ?1 AND returned_at IS NULL",
        [id],
        |r| r.get(0),
    )?;
    if active > 0 {
        return Err(AppError::has_active_loans(
            "Este professor tem empréstimos ativos; registre as devoluções antes de excluir.",
        ));
    }
    tx.execute("DELETE FROM teachers WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::loans::{self, LoanInput};
    use crate::db::testutil::{book, class, db, teacher, today};
    use crate::db::types::ReaderKind;
    use crate::error::ErrorCode;

    #[test]
    fn crud_e_busca_sem_acento() {
        let conn = db();
        let t = create(
            &conn,
            &TeacherInput {
                name: "  Joana Ávila ".into(),
                contact: Some("  ".into()),
            },
            today(),
        )
        .unwrap();
        assert_eq!(t.name, "Joana Ávila");
        assert_eq!(t.contact, None);
        teacher(&conn, "Carlos");
        assert_eq!(list(&conn, Some("avila"), today()).unwrap().len(), 1);
        assert_eq!(list(&conn, None, today()).unwrap().len(), 2);
        let u = update(
            &conn,
            t.id,
            &TeacherInput {
                name: "Joana".into(),
                contact: Some("9999".into()),
            },
            today(),
        )
        .unwrap();
        assert_eq!(u.contact.as_deref(), Some("9999"));
        assert!(
            create(
                &conn,
                &TeacherInput {
                    name: " ".into(),
                    contact: None
                },
                today()
            )
            .is_err()
        );
    }

    #[test]
    fn exclusao_bloqueada_por_turma_e_por_emprestimo() {
        let conn = db();
        let t = teacher(&conn, "Marta");
        class(&conn, "5º A", t);
        assert_eq!(delete(&conn, t).unwrap_err().code, ErrorCode::InUse);

        let t2 = teacher(&conn, "Pedro");
        let b = book(&conn, "Livro", &["A1"]);
        let copy_id = b_copy(&conn, "A1");
        let loan = loans::create(
            &conn,
            &LoanInput {
                copy_id,
                reader_kind: ReaderKind::Teacher,
                reader_id: t2,
                loaned_at: "2026-10-01".into(),
                due_at: "2026-10-15".into(),
            },
            today(),
        )
        .unwrap();
        assert_eq!(
            delete(&conn, t2).unwrap_err().code,
            ErrorCode::HasActiveLoans
        );
        loans::return_loan(&conn, loan.id, "2026-10-02", true, today()).unwrap();
        assert_eq!(get(&conn, t2, today()).unwrap().read_count, 1);
        delete(&conn, t2).unwrap();
        // histórico apagado junto
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM loans", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
        assert_eq!(delete(&conn, t2).unwrap_err().code, ErrorCode::NotFound);
        let _ = b;
    }

    fn b_copy(conn: &Connection, code: &str) -> i64 {
        conn.query_row(
            "SELECT id FROM copies WHERE registration_code = ?1",
            [code],
            |r| r.get(0),
        )
        .unwrap()
    }
}
