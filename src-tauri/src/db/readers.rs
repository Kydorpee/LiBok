//! Leitores (alunos e professores): busca unificada e resumo.

use super::loans::{self, Loan};
use super::normalize::{like_tokens, normalize};
use super::readings;
use super::students::{self, Student};
use super::teachers::{self, Teacher};
use super::types::{ClassReading, Reader, ReaderKind};
use super::{Filter, date_lit, text};
use crate::error::AppResult;
use chrono::NaiveDate;
use rusqlite::{Connection, params_from_iter};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryCounts {
    pub active: i64,
    pub overdue: i64,
    pub read: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderSummary {
    pub reader: Reader,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub student: Option<Student>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub teacher: Option<Teacher>,
    pub active_loans: Vec<Loan>,
    pub history: Vec<Loan>,
    /// Leituras coletivas do aluno (vazio para professor).
    pub readings: Vec<ClassReading>,
    pub counts: SummaryCounts,
}

impl Reader {
    pub fn from_student(s: &Student) -> Self {
        Reader {
            kind: ReaderKind::Student,
            id: s.id,
            name: s.name.clone(),
            class_label: s.class_room.as_ref().map(|c| c.name.clone()),
            active_loans: s.active_loans,
            overdue_loans: s.overdue_loans,
        }
    }

    pub fn from_teacher(t: &Teacher) -> Self {
        Reader {
            kind: ReaderKind::Teacher,
            id: t.id,
            name: t.name.clone(),
            class_label: None,
            active_loans: t.active_loans,
            overdue_loans: t.overdue_loans,
        }
    }
}

/// Busca alunos (nome, matrícula, turma) e professores (nome) sem acento, ordenados por nome.
pub fn search_readers(
    conn: &Connection,
    query: &str,
    limit: Option<i64>,
    today: NaiveDate,
) -> AppResult<Vec<Reader>> {
    let limit = limit.unwrap_or(20).clamp(1, 100);
    let today_lit = date_lit(today);
    let tokens = like_tokens(query);

    let mut sf = Filter::new();
    let mut tf = Filter::new();
    for token in &tokens {
        sf.push(
            "(s.name_norm LIKE ? ESCAPE '\\' OR libok_norm(s.registration) LIKE ? ESCAPE '\\'
              OR c.name_norm LIKE ? ESCAPE '\\')",
            vec![text(token); 3],
        );
        tf.push("t.name_norm LIKE ? ESCAPE '\\'", vec![text(token)]);
    }

    let mut readers: Vec<(String, Reader)> = Vec::new();

    let sql = format!(
        "SELECT s.id, s.name, c.name,
            (SELECT COUNT(*) FROM loans l WHERE l.student_id = s.id AND l.returned_at IS NULL),
            (SELECT COUNT(*) FROM loans l WHERE l.student_id = s.id AND l.returned_at IS NULL
                AND l.due_at < {today_lit}),
            s.name_norm
         FROM students s LEFT JOIN classes c ON c.id = s.class_id{}
         ORDER BY s.name_norm, s.id LIMIT ?",
        sf.where_sql()
    );
    let values = sf.params_with(vec![rusqlite::types::Value::Integer(limit)]);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(values.iter()), |r| {
        Ok((
            r.get::<_, String>(5)?,
            Reader {
                kind: ReaderKind::Student,
                id: r.get(0)?,
                name: r.get(1)?,
                class_label: r.get(2)?,
                active_loans: r.get(3)?,
                overdue_loans: r.get(4)?,
            },
        ))
    })?;
    for row in rows {
        readers.push(row?);
    }

    let sql = format!(
        "SELECT t.id, t.name,
            (SELECT COUNT(*) FROM loans l WHERE l.teacher_id = t.id AND l.returned_at IS NULL),
            (SELECT COUNT(*) FROM loans l WHERE l.teacher_id = t.id AND l.returned_at IS NULL
                AND l.due_at < {today_lit}),
            t.name_norm
         FROM teachers t{}
         ORDER BY t.name_norm, t.id LIMIT ?",
        tf.where_sql()
    );
    let values = tf.params_with(vec![rusqlite::types::Value::Integer(limit)]);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(params_from_iter(values.iter()), |r| {
        Ok((
            r.get::<_, String>(4)?,
            Reader {
                kind: ReaderKind::Teacher,
                id: r.get(0)?,
                name: r.get(1)?,
                class_label: None,
                active_loans: r.get(2)?,
                overdue_loans: r.get(3)?,
            },
        ))
    })?;
    for row in rows {
        readers.push(row?);
    }

    readers.sort_by_cached_key(|(norm, _)| norm.clone());
    readers.truncate(limit as usize);
    debug_assert!(readers.iter().all(|(n, r)| *n == normalize(&r.name)));
    Ok(readers.into_iter().map(|(_, r)| r).collect())
}

/// Resumo do leitor: indicadores, empréstimos ativos e histórico.
pub fn get_reader_summary(
    conn: &Connection,
    kind: ReaderKind,
    id: i64,
    today: NaiveDate,
) -> AppResult<ReaderSummary> {
    let (reader, student, teacher, read) = match kind {
        ReaderKind::Student => {
            let s = students::get(conn, id, today)?;
            (
                Reader::from_student(&s),
                Some(s.clone()),
                None,
                s.read_count,
            )
        }
        ReaderKind::Teacher => {
            let t = teachers::get(conn, id, today)?;
            (
                Reader::from_teacher(&t),
                None,
                Some(t.clone()),
                t.read_count,
            )
        }
    };
    let active_loans = loans::for_reader(conn, kind, id, false, today)?;
    let history = loans::for_reader(conn, kind, id, true, today)?;
    let readings = match kind {
        ReaderKind::Student => readings::list_for_student(conn, id)?,
        ReaderKind::Teacher => Vec::new(),
    };
    let counts = SummaryCounts {
        active: reader.active_loans,
        overdue: reader.overdue_loans,
        read,
    };
    Ok(ReaderSummary {
        reader,
        student,
        teacher,
        active_loans,
        history,
        readings,
        counts,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::loans::{LoanInput, LoanStatus};
    use crate::db::testutil::{book, db, school, teacher, today};
    use crate::error::ErrorCode;

    fn lend(conn: &Connection, code: &str, kind: ReaderKind, reader: i64, due: &str) -> i64 {
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
                reader_kind: kind,
                reader_id: reader,
                loaned_at: "2026-09-20".into(),
                due_at: due.into(),
            },
            today(),
        )
        .unwrap()
        .id
    }

    #[test]
    fn busca_alunos_e_professores_sem_acento() {
        let conn = db();
        let (_, _, _) = school(&conn);
        teacher(&conn, "João Batista");
        let found = search_readers(&conn, "joao", None, today()).unwrap();
        assert_eq!(found.len(), 2);
        assert_eq!(found[0].name, "João Batista");
        assert_eq!(found[0].kind, ReaderKind::Teacher);
        assert_eq!(found[0].class_label, None);
        assert_eq!(found[1].kind, ReaderKind::Student);
        assert_eq!(found[1].class_label.as_deref(), Some("5º ano A"));
        // por matrícula e por turma
        assert_eq!(
            search_readers(&conn, "2026001", None, today())
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            search_readers(&conn, "5o ano", None, today())
                .unwrap()
                .len(),
            1
        );
        assert_eq!(
            search_readers(&conn, "zzz", None, today()).unwrap().len(),
            0
        );
        // vazio lista todos (respeitando limite)
        assert_eq!(search_readers(&conn, "", None, today()).unwrap().len(), 3);
        assert_eq!(
            search_readers(&conn, "", Some(2), today()).unwrap().len(),
            2
        );
    }

    #[test]
    fn resumo_do_aluno() {
        let conn = db();
        let (_, _, s) = school(&conn);
        book(&conn, "L1", &["A1"]);
        book(&conn, "L2", &["A2"]);
        book(&conn, "L3", &["A3"]);
        let done = lend(&conn, "A1", ReaderKind::Student, s, "2026-10-01");
        loans::return_loan(&conn, done, "2026-09-25", true, today()).unwrap();
        lend(&conn, "A2", ReaderKind::Student, s, "2026-10-01"); // atrasado
        lend(&conn, "A3", ReaderKind::Student, s, "2026-10-30");

        let sum = get_reader_summary(&conn, ReaderKind::Student, s, today()).unwrap();
        assert_eq!(
            sum.counts,
            SummaryCounts {
                active: 2,
                overdue: 1,
                read: 1
            }
        );
        assert_eq!(sum.reader.kind, ReaderKind::Student);
        assert!(sum.student.is_some() && sum.teacher.is_none());
        assert_eq!(sum.active_loans.len(), 2);
        assert_eq!(sum.active_loans[0].status, LoanStatus::Overdue);
        assert_eq!(sum.history.len(), 1);
        assert!(sum.history[0].marked_read);
    }

    #[test]
    fn resumo_do_professor_e_inexistente() {
        let conn = db();
        let t = teacher(&conn, "Marta");
        book(&conn, "L1", &["A1"]);
        lend(&conn, "A1", ReaderKind::Teacher, t, "2026-10-30");
        let sum = get_reader_summary(&conn, ReaderKind::Teacher, t, today()).unwrap();
        assert!(sum.teacher.is_some() && sum.student.is_none());
        assert_eq!(sum.counts.active, 1);
        assert_eq!(sum.reader.class_label, None);
        assert_eq!(
            get_reader_summary(&conn, ReaderKind::Student, 999, today())
                .unwrap_err()
                .code,
            ErrorCode::NotFound
        );
    }

    #[test]
    fn aluno_sem_turma_aparece_na_busca_e_no_resumo() {
        let conn = db();
        let (_, c, s) = school(&conn);
        crate::db::classes::delete(&conn, c).unwrap();
        let found = search_readers(&conn, "joao", None, today()).unwrap();
        assert_eq!(found.len(), 1);
        assert_eq!(found[0].class_label, None);
        assert_eq!(search_readers(&conn, "", None, today()).unwrap().len(), 2); // aluno + professora
        book(&conn, "L1", &["A1"]);
        lend(&conn, "A1", ReaderKind::Student, s, "2026-10-30");
        let sum = get_reader_summary(&conn, ReaderKind::Student, s, today()).unwrap();
        assert_eq!(sum.counts.active, 1);
        assert_eq!(sum.reader.class_label, None);
        assert_eq!(sum.active_loans[0].reader.class_label, None);
    }
}
