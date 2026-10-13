//! Repositório de turmas.

use super::normalize::{like_tokens, normalize};
use super::students::{self, Student};
use super::types::{Ref, Shift};
use super::{Filter, date_lit, map_write_err, require, text};
use crate::error::{AppError, AppResult};
use chrono::NaiveDate;
use rusqlite::types::Value;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassRoom {
    pub id: i64,
    pub name: String,
    pub school_year: i64,
    pub shift: Shift,
    pub teacher: Ref,
    pub student_count: i64,
    pub active_loans: i64,
    pub overdue_loans: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassInput {
    pub name: String,
    pub school_year: i64,
    pub shift: Shift,
    pub teacher_id: i64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ClassQuery {
    pub text: Option<String>,
    pub school_year: Option<i64>,
    pub shift: Option<Shift>,
}

/// `get_class`: turma + alunos.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassDetail {
    pub class_room: ClassRoom,
    pub students: Vec<Student>,
}

fn select(today: NaiveDate) -> String {
    let today = date_lit(today);
    format!(
        "SELECT c.id, c.name, c.school_year, c.shift, c.teacher_id, t.name,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id),
            (SELECT COUNT(*) FROM loans l JOIN students s ON s.id = l.student_id
                WHERE s.class_id = c.id AND l.returned_at IS NULL),
            (SELECT COUNT(*) FROM loans l JOIN students s ON s.id = l.student_id
                WHERE s.class_id = c.id AND l.returned_at IS NULL AND l.due_at < {today})
         FROM classes c JOIN teachers t ON t.id = c.teacher_id"
    )
}

fn map_class(row: &rusqlite::Row<'_>) -> rusqlite::Result<ClassRoom> {
    Ok(ClassRoom {
        id: row.get(0)?,
        name: row.get(1)?,
        school_year: row.get(2)?,
        shift: row.get(3)?,
        teacher: Ref {
            id: row.get(4)?,
            name: row.get(5)?,
        },
        student_count: row.get(6)?,
        active_loans: row.get(7)?,
        overdue_loans: row.get(8)?,
    })
}

pub fn get(conn: &Connection, id: i64, today: NaiveDate) -> AppResult<ClassRoom> {
    conn.query_row(
        &format!("{} WHERE c.id = ?1", select(today)),
        [id],
        map_class,
    )
    .optional()?
    .ok_or_else(|| AppError::not_found("Turma não encontrada."))
}

/// Turma com a lista de alunos (ordenados por nome).
pub fn get_detail(conn: &Connection, id: i64, today: NaiveDate) -> AppResult<ClassDetail> {
    Ok(ClassDetail {
        class_room: get(conn, id, today)?,
        students: students::list_by_class(conn, id, today)?,
    })
}

/// Lista turmas (mais recentes primeiro), com busca por nome e filtros de ano e turno.
pub fn list(conn: &Connection, query: &ClassQuery, today: NaiveDate) -> AppResult<Vec<ClassRoom>> {
    let mut filter = Filter::new();
    if let Some(q) = query.text.as_deref() {
        for token in like_tokens(q) {
            filter.push(
                "(c.name_norm LIKE ? ESCAPE '\\' OR t.name_norm LIKE ? ESCAPE '\\')",
                vec![text(&token), text(&token)],
            );
        }
    }
    if let Some(year) = query.school_year {
        filter.push("c.school_year = ?", vec![Value::Integer(year)]);
    }
    if let Some(shift) = query.shift {
        filter.push("c.shift = ?", vec![text(shift.as_str())]);
    }
    let sql = format!(
        "{}{} ORDER BY c.school_year DESC, c.name_norm, c.id",
        select(today),
        filter.where_sql()
    );
    let values = filter.params_with(vec![]);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(values.iter()), map_class)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

fn clean(
    conn: &Connection,
    input: &ClassInput,
    except_id: Option<i64>,
) -> AppResult<(String, String)> {
    let name = require("name", "o nome da turma", &input.name)?;
    if !(1900..=2200).contains(&input.school_year) {
        return Err(AppError::validation(
            "schoolYear",
            "Informe um ano letivo válido.",
        ));
    }
    let teacher_ok: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM teachers WHERE id = ?1)",
        [input.teacher_id],
        |r| r.get(0),
    )?;
    if !teacher_ok {
        return Err(AppError::validation(
            "teacherId",
            "Selecione o professor responsável.",
        ));
    }
    let norm = normalize(&name);
    let dup: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM classes WHERE name_norm = ?1 AND school_year = ?2 AND id IS NOT ?3)",
        params![norm, input.school_year, except_id],
        |r| r.get(0),
    )?;
    if dup {
        return Err(AppError::validation(
            "name",
            "Já existe uma turma com esse nome neste ano letivo.",
        ));
    }
    Ok((name, norm))
}

pub fn create(conn: &Connection, input: &ClassInput, today: NaiveDate) -> AppResult<ClassRoom> {
    let (name, norm) = clean(conn, input, None)?;
    conn.execute(
        "INSERT INTO classes (name, name_norm, school_year, shift, teacher_id)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            name,
            norm,
            input.school_year,
            input.shift.as_str(),
            input.teacher_id
        ],
    )
    .map_err(map_write_err)?;
    get(conn, conn.last_insert_rowid(), today)
}

pub fn update(
    conn: &Connection,
    id: i64,
    input: &ClassInput,
    today: NaiveDate,
) -> AppResult<ClassRoom> {
    get(conn, id, today)?;
    let (name, norm) = clean(conn, input, Some(id))?;
    conn.execute(
        "UPDATE classes SET name = ?1, name_norm = ?2, school_year = ?3, shift = ?4, teacher_id = ?5
         WHERE id = ?6",
        params![
            name,
            norm,
            input.school_year,
            input.shift.as_str(),
            input.teacher_id,
            id
        ],
    )
    .map_err(map_write_err)?;
    get(conn, id, today)
}

/// Exclui a turma; `IN_USE` se houver alunos.
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    let tx = conn.unchecked_transaction()?;
    let exists: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM classes WHERE id = ?1)",
        [id],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(AppError::not_found("Turma não encontrada."));
    }
    let students: i64 = tx.query_row(
        "SELECT COUNT(*) FROM students WHERE class_id = ?1",
        [id],
        |r| r.get(0),
    )?;
    if students > 0 {
        return Err(AppError::in_use(
            "Esta turma tem alunos; mova ou exclua os alunos antes de excluir a turma.",
        ));
    }
    tx.execute("DELETE FROM classes WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::testutil::{db, school, student, teacher, today};
    use crate::error::ErrorCode;

    fn input(name: &str, year: i64, teacher_id: i64) -> ClassInput {
        ClassInput {
            name: name.into(),
            school_year: year,
            shift: Shift::Afternoon,
            teacher_id,
        }
    }

    #[test]
    fn cria_lista_e_filtra() {
        let conn = db();
        let t = teacher(&conn, "Marta");
        let a = create(&conn, &input("5º ano A", 2026, t), today()).unwrap();
        create(&conn, &input("6º ano B", 2025, t), today()).unwrap();
        assert_eq!(a.teacher.name, "Marta");
        assert_eq!(a.shift, Shift::Afternoon);
        assert_eq!(
            list(&conn, &ClassQuery::default(), today()).unwrap().len(),
            2
        );
        let by_year = ClassQuery {
            school_year: Some(2025),
            ..Default::default()
        };
        assert_eq!(list(&conn, &by_year, today()).unwrap()[0].name, "6º ano B");
        let by_text = ClassQuery {
            text: Some("5o".into()),
            ..Default::default()
        };
        // "5º" normaliza para "5o": digitar "5o" ou "5º" encontra a turma
        assert_eq!(list(&conn, &by_text, today()).unwrap().len(), 1);
        let by_text = ClassQuery {
            text: Some("5º ANO".into()),
            ..Default::default()
        };
        assert_eq!(list(&conn, &by_text, today()).unwrap().len(), 1);
        let by_shift = ClassQuery {
            shift: Some(Shift::Morning),
            ..Default::default()
        };
        assert!(list(&conn, &by_shift, today()).unwrap().is_empty());
    }

    #[test]
    fn nome_mais_ano_sao_unicos() {
        let conn = db();
        let t = teacher(&conn, "Marta");
        create(&conn, &input("5º ano A", 2026, t), today()).unwrap();
        let err = create(&conn, &input(" 5º ANO a ", 2026, t), today()).unwrap_err();
        assert_eq!(err.code, ErrorCode::Validation);
        assert_eq!(err.field.as_deref(), Some("name"));
        assert!(create(&conn, &input("5º ano A", 2027, t), today()).is_ok());
    }

    #[test]
    fn valida_campos_e_professor() {
        let conn = db();
        let t = teacher(&conn, "Marta");
        assert!(create(&conn, &input("", 2026, t), today()).is_err());
        assert_eq!(
            create(&conn, &input("X", 2026, 999), today())
                .unwrap_err()
                .field
                .as_deref(),
            Some("teacherId")
        );
        assert!(create(&conn, &input("X", 12, t), today()).is_err());
    }

    #[test]
    fn troca_de_professor_e_contagem_de_alunos() {
        let conn = db();
        let (t, c, _) = school(&conn);
        student(&conn, "Maria", "2026002", c);
        let t2 = teacher(&conn, "Outro");
        let u = update(&conn, c, &input("5º ano A", 2026, t2), today()).unwrap();
        assert_eq!(u.teacher.id, t2);
        assert_eq!(u.student_count, 2);
        let d = get_detail(&conn, c, today()).unwrap();
        assert_eq!(d.students.len(), 2);
        assert_ne!(t, t2);
    }

    #[test]
    fn excluir_so_sem_alunos() {
        let conn = db();
        let (t, c, _) = school(&conn);
        assert_eq!(delete(&conn, c).unwrap_err().code, ErrorCode::InUse);
        let c2 = create(&conn, &input("Vazia", 2026, t), today()).unwrap();
        delete(&conn, c2.id).unwrap();
        assert_eq!(delete(&conn, c2.id).unwrap_err().code, ErrorCode::NotFound);
    }
}
