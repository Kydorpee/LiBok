//! Estatísticas do dashboard.

use super::books::{self, Book};
use super::categories::{self, Category};
use super::date_lit;
use crate::error::AppResult;
use chrono::NaiveDate;
use rusqlite::Connection;
use serde::Serialize;

/// Quantos livros aparecem em "últimos cadastrados".
pub const RECENT_LIMIT: i64 = 5;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Stats {
    pub total_books: i64,
    pub total_copies: i64,
    /// Somente categorias com ao menos um livro, da maior para a menor.
    pub by_category: Vec<Category>,
    pub recent: Vec<Book>,
    pub active_loans: i64,
    pub overdue_loans: i64,
}

pub fn get(conn: &Connection, today: NaiveDate) -> AppResult<Stats> {
    let total_books = conn.query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))?;
    let total_copies = conn.query_row("SELECT COUNT(*) FROM copies", [], |r| r.get(0))?;
    let active_loans = conn.query_row(
        "SELECT COUNT(*) FROM loans WHERE returned_at IS NULL",
        [],
        |r| r.get(0),
    )?;
    let overdue_loans = conn.query_row(
        &format!(
            "SELECT COUNT(*) FROM loans WHERE returned_at IS NULL AND due_at < {}",
            date_lit(today)
        ),
        [],
        |r| r.get(0),
    )?;
    let mut by_category: Vec<Category> = categories::list(conn)?
        .into_iter()
        .filter(|c| c.book_count > 0)
        .collect();
    by_category.sort_by(|a, b| b.book_count.cmp(&a.book_count).then(a.name.cmp(&b.name)));
    Ok(Stats {
        total_books,
        total_copies,
        by_category,
        recent: books::recent(conn, RECENT_LIMIT)?,
        active_loans,
        overdue_loans,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::loans::{self, LoanInput};
    use crate::db::testutil::{book, db, school, today};
    use crate::db::types::ReaderKind;

    #[test]
    fn banco_vazio() {
        let s = get(&db(), today()).unwrap();
        assert_eq!((s.total_books, s.total_copies, s.active_loans), (0, 0, 0));
        assert!(s.by_category.is_empty() && s.recent.is_empty());
    }

    #[test]
    fn totais_categorias_e_emprestimos() {
        let conn = db();
        let (_, _, student) = school(&conn);
        book(&conn, "L1", &["A1", "A2"]);
        book(&conn, "L2", &["B1"]);
        for (code, due) in [("A1", "2026-10-01"), ("B1", "2026-10-30")] {
            let copy_id = conn
                .query_row(
                    "SELECT id FROM copies WHERE registration_code = ?1",
                    [code],
                    |r| r.get(0),
                )
                .unwrap();
            loans::create(
                &conn,
                &LoanInput {
                    copy_id,
                    reader_kind: ReaderKind::Student,
                    reader_id: student,
                    loaned_at: "2026-09-20".into(),
                    due_at: due.into(),
                },
                today(),
            )
            .unwrap();
        }
        let s = get(&conn, today()).unwrap();
        assert_eq!((s.total_books, s.total_copies), (2, 3));
        assert_eq!((s.active_loans, s.overdue_loans), (2, 1));
        assert_eq!(s.by_category.len(), 1);
        assert_eq!(s.by_category[0].book_count, 2);
        assert_eq!(s.recent.len(), 2);
    }
}
