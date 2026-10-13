//! Repositório de empréstimos (por exemplar) e status de exemplares.

use super::normalize::{like_tokens, normalize};
use super::types::{Page, Reader, ReaderKind};
use super::{Filter, date_lit, map_write_err, paging, parse_date, text};
use crate::error::{AppError, AppResult};
use chrono::NaiveDate;
use rusqlite::types::Value;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LoanStatus {
    Active,
    Overdue,
    Returned,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoanBook {
    /// `None` se o livro foi excluído depois da devolução.
    pub id: Option<i64>,
    pub title: String,
    pub author: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Loan {
    pub id: i64,
    pub copy_id: Option<i64>,
    pub code: String,
    pub book: LoanBook,
    pub reader: Reader,
    pub loaned_at: String,
    pub due_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub returned_at: Option<String>,
    pub marked_read: bool,
    pub status: LoanStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoanInput {
    pub copy_id: i64,
    pub reader_kind: ReaderKind,
    pub reader_id: i64,
    pub loaned_at: String,
    pub due_at: String,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum StatusFilter {
    /// Não devolvidos (inclui atrasados). Padrão: é a aba inicial da tela.
    #[default]
    Active,
    Overdue,
    Returned,
    All,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LoanQuery {
    pub status: Option<StatusFilter>,
    pub text: Option<String>,
    pub class_id: Option<i64>,
    pub reader_kind: Option<ReaderKind>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoanCounts {
    pub active: i64,
    pub overdue: i64,
    pub returned: i64,
    pub all: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoanPage {
    #[serde(flatten)]
    pub page: Page<Loan>,
    pub counts: LoanCounts,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CopyState {
    Available,
    Loaned,
    Overdue,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyLoan {
    pub id: i64,
    pub reader: Reader,
    pub due_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyStatus {
    pub copy_id: i64,
    pub code: String,
    pub status: CopyState,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub loan: Option<CopyLoan>,
}

/// Chave de "livro distinto" para contar lidos: `book_id` quando há, senão o
/// título+autor normalizado do snapshot (livro apagado). Alias esperado: `l`.
pub(crate) const READ_KEY: &str = "COALESCE('b' || l.book_id, 'n' || l.book_norm)";

const JOINS: &str = " FROM loans l
     LEFT JOIN books b ON b.id = l.book_id
     LEFT JOIN students s ON s.id = l.student_id
     LEFT JOIN classes c ON c.id = s.class_id
     LEFT JOIN teachers t ON t.id = l.teacher_id";

fn select(today: NaiveDate) -> String {
    let today = date_lit(today);
    format!(
        "SELECT l.id, l.copy_id, l.copy_code, l.book_id, COALESCE(b.title, l.book_title),
            COALESCE(b.author, l.book_author),
            l.loaned_at, l.due_at, l.returned_at, l.marked_read,
            l.student_id, l.teacher_id, COALESCE(s.name, t.name), c.name,
            (SELECT COUNT(*) FROM loans x WHERE x.returned_at IS NULL
                AND x.student_id IS l.student_id AND x.teacher_id IS l.teacher_id),
            (SELECT COUNT(*) FROM loans x WHERE x.returned_at IS NULL
                AND x.student_id IS l.student_id AND x.teacher_id IS l.teacher_id
                AND x.due_at < {today})
         {JOINS}"
    )
}

/// Status calculado (não gravado): devolvido, atrasado (`due_at < hoje`) ou ativo.
pub fn status_of(returned_at: Option<&str>, due_at: &str, today: NaiveDate) -> LoanStatus {
    if returned_at.is_some() {
        LoanStatus::Returned
    } else if due_at < super::fmt_date(today).as_str() {
        LoanStatus::Overdue
    } else {
        LoanStatus::Active
    }
}

fn map_loan(today: NaiveDate) -> impl Fn(&rusqlite::Row<'_>) -> rusqlite::Result<Loan> {
    move |row| {
        let returned_at: Option<String> = row.get(8)?;
        let due_at: String = row.get(7)?;
        let student_id: Option<i64> = row.get(10)?;
        let teacher_id: Option<i64> = row.get(11)?;
        let (kind, reader_id) = match (student_id, teacher_id) {
            (Some(id), _) => (ReaderKind::Student, id),
            (None, Some(id)) => (ReaderKind::Teacher, id),
            (None, None) => {
                return Err(rusqlite::Error::InvalidQuery);
            }
        };
        let status = status_of(returned_at.as_deref(), &due_at, today);
        Ok(Loan {
            id: row.get(0)?,
            copy_id: row.get(1)?,
            code: row.get(2)?,
            book: LoanBook {
                id: row.get(3)?,
                title: row.get(4)?,
                author: row.get(5)?,
            },
            loaned_at: row.get(6)?,
            due_at,
            returned_at,
            marked_read: row.get::<_, i64>(9)? != 0,
            status,
            reader: Reader {
                kind,
                id: reader_id,
                name: row.get(12)?,
                class_label: row.get(13)?,
                active_loans: row.get(14)?,
                overdue_loans: row.get(15)?,
            },
        })
    }
}

pub fn get(conn: &Connection, id: i64, today: NaiveDate) -> AppResult<Loan> {
    conn.query_row(
        &format!("{} WHERE l.id = ?1", select(today)),
        [id],
        map_loan(today),
    )
    .optional()?
    .ok_or_else(|| AppError::not_found("Empréstimo não encontrado."))
}

/// Empréstimos de um leitor: ativos (por vencimento) ou histórico (devolvidos, mais recentes primeiro).
pub fn for_reader(
    conn: &Connection,
    kind: ReaderKind,
    reader_id: i64,
    returned: bool,
    today: NaiveDate,
) -> AppResult<Vec<Loan>> {
    let (col, state, order) = (
        match kind {
            ReaderKind::Student => "l.student_id",
            ReaderKind::Teacher => "l.teacher_id",
        },
        if returned {
            "l.returned_at IS NOT NULL"
        } else {
            "l.returned_at IS NULL"
        },
        if returned {
            "l.returned_at DESC, l.id DESC"
        } else {
            "l.due_at ASC, l.id ASC"
        },
    );
    let mut stmt = conn.prepare(&format!(
        "{} WHERE {col} = ?1 AND {state} ORDER BY {order}",
        select(today)
    ))?;
    let rows = stmt.query_map([reader_id], map_loan(today))?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

/// Registra um empréstimo; `COPY_UNAVAILABLE` se o exemplar já estiver emprestado.
pub fn create(conn: &Connection, input: &LoanInput, today: NaiveDate) -> AppResult<Loan> {
    let loaned = parse_date("loanedAt", &input.loaned_at)?;
    let due = parse_date("dueAt", &input.due_at)?;
    if due < loaned {
        return Err(AppError::validation(
            "dueAt",
            "A devolução prevista não pode ser anterior à data do empréstimo.",
        ));
    }
    let tx = conn.unchecked_transaction()?;
    let (code, title, author, book_id): (String, String, String, i64) = tx
        .query_row(
            "SELECT cp.registration_code, b.title, b.author, b.id
             FROM copies cp JOIN books b ON b.id = cp.book_id WHERE cp.id = ?1",
            [input.copy_id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::not_found("Exemplar não encontrado."))?;

    let reader_exists: bool = match input.reader_kind {
        ReaderKind::Student => tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM students WHERE id = ?1)",
            [input.reader_id],
            |r| r.get(0),
        )?,
        ReaderKind::Teacher => tx.query_row(
            "SELECT EXISTS(SELECT 1 FROM teachers WHERE id = ?1)",
            [input.reader_id],
            |r| r.get(0),
        )?,
    };
    if !reader_exists {
        return Err(AppError::not_found("Leitor não encontrado."));
    }

    let busy: bool = tx.query_row(
        "SELECT EXISTS(SELECT 1 FROM loans WHERE copy_id = ?1 AND returned_at IS NULL)",
        [input.copy_id],
        |r| r.get(0),
    )?;
    if busy {
        return Err(AppError::copy_unavailable(format!(
            "O exemplar {code} já está emprestado."
        )));
    }

    let (student_id, teacher_id) = match input.reader_kind {
        ReaderKind::Student => (Some(input.reader_id), None),
        ReaderKind::Teacher => (None, Some(input.reader_id)),
    };
    tx.execute(
        "INSERT INTO loans (copy_id, student_id, teacher_id, copy_code, book_title, book_author,
                            book_norm, loaned_at, due_at, book_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            input.copy_id,
            student_id,
            teacher_id,
            code,
            title,
            author,
            normalize(&format!("{title} {author}")),
            super::fmt_date(loaned),
            super::fmt_date(due),
            book_id
        ],
    )
    .map_err(map_write_err)?;
    let id = tx.last_insert_rowid();
    tx.commit()?;
    get(conn, id, today)
}

/// Registra a devolução (`returned_at` = `YYYY-MM-DD`), opcionalmente marcando como lido.
pub fn return_loan(
    conn: &Connection,
    id: i64,
    returned_at: &str,
    marked_read: bool,
    today: NaiveDate,
) -> AppResult<Loan> {
    let returned = parse_date("returnedAt", returned_at)?;
    let (loaned_at, already): (String, Option<String>) = conn
        .query_row(
            "SELECT loaned_at, returned_at FROM loans WHERE id = ?1",
            [id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()?
        .ok_or_else(|| AppError::not_found("Empréstimo não encontrado."))?;
    if already.is_some() {
        return Err(AppError::validation(
            "returnedAt",
            "Este empréstimo já foi devolvido.",
        ));
    }
    let returned_s = super::fmt_date(returned);
    if returned_s < loaned_at {
        return Err(AppError::validation(
            "returnedAt",
            "A devolução não pode ser anterior à data do empréstimo.",
        ));
    }
    conn.execute(
        "UPDATE loans SET returned_at = ?1, marked_read = ?2 WHERE id = ?3",
        params![returned_s, marked_read, id],
    )?;
    get(conn, id, today)
}

/// Lista empréstimos com abas/contagens. Os `counts` respeitam busca e filtros, mas não a aba.
pub fn list(conn: &Connection, query: &LoanQuery, today: NaiveDate) -> AppResult<LoanPage> {
    let today_lit = date_lit(today);
    let mut base = Filter::new();
    if let Some(q) = query.text.as_deref() {
        for token in like_tokens(q) {
            base.push(
                "(COALESCE(b.title_norm || ' ' || b.author_norm, l.book_norm) LIKE ? ESCAPE '\\' OR libok_norm(l.copy_code) LIKE ? ESCAPE '\\'
                  OR COALESCE(s.name_norm, t.name_norm) LIKE ? ESCAPE '\\')",
                vec![text(&token); 3],
            );
        }
    }
    if let Some(class_id) = query.class_id {
        base.push("s.class_id = ?", vec![Value::Integer(class_id)]);
    }
    match query.reader_kind {
        Some(ReaderKind::Student) => base.push("l.student_id IS NOT NULL", vec![]),
        Some(ReaderKind::Teacher) => base.push("l.teacher_id IS NOT NULL", vec![]),
        None => {}
    }

    // Contagens por aba.
    let count_values = base.params_with(vec![]);
    let counts = conn.query_row(
        &format!(
            "SELECT COUNT(*),
                COALESCE(SUM(CASE WHEN l.returned_at IS NULL THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN l.returned_at IS NULL AND l.due_at < {today_lit}
                                  THEN 1 ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN l.returned_at IS NOT NULL THEN 1 ELSE 0 END), 0)
             {JOINS}{}",
            base.where_sql()
        ),
        params_from_iter(count_values.iter()),
        |r| {
            Ok(LoanCounts {
                all: r.get(0)?,
                active: r.get(1)?,
                overdue: r.get(2)?,
                returned: r.get(3)?,
            })
        },
    )?;

    let status = query.status.unwrap_or_default();
    let total = match status {
        StatusFilter::Active => counts.active,
        StatusFilter::Overdue => counts.overdue,
        StatusFilter::Returned => counts.returned,
        StatusFilter::All => counts.all,
    };
    let mut full = base;
    match status {
        StatusFilter::Active => full.push("l.returned_at IS NULL", vec![]),
        StatusFilter::Overdue => full.push(
            format!("(l.returned_at IS NULL AND l.due_at < {today_lit})"),
            vec![],
        ),
        StatusFilter::Returned => full.push("l.returned_at IS NOT NULL", vec![]),
        StatusFilter::All => {}
    }
    let order = match status {
        StatusFilter::Returned => "l.returned_at DESC, l.id DESC",
        _ => {
            "(l.returned_at IS NOT NULL), CASE WHEN l.returned_at IS NULL THEN l.due_at END ASC,
             l.returned_at DESC, l.id DESC"
        }
    };
    let (page, page_size, offset) = paging(query.page, query.page_size);
    let values = full.params_with(vec![Value::Integer(page_size), Value::Integer(offset)]);
    let mut stmt = conn.prepare(&format!(
        "{}{} ORDER BY {order} LIMIT ? OFFSET ?",
        select(today),
        full.where_sql()
    ))?;
    let items = stmt
        .query_map(params_from_iter(values.iter()), map_loan(today))?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(LoanPage {
        page: Page {
            items,
            total,
            page,
            page_size,
        },
        counts,
    })
}

/// Status de cada exemplar do livro (disponível / emprestado / atrasado).
pub fn list_copy_status(
    conn: &Connection,
    book_id: i64,
    today: NaiveDate,
) -> AppResult<Vec<CopyStatus>> {
    let exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM books WHERE id = ?1)",
        [book_id],
        |r| r.get(0),
    )?;
    if !exists {
        return Err(AppError::not_found("Livro não encontrado."));
    }
    let rows: Vec<(i64, String, Option<i64>)> = {
        let mut stmt = conn.prepare(
            "SELECT cp.id, cp.registration_code,
                (SELECT l.id FROM loans l WHERE l.copy_id = cp.id AND l.returned_at IS NULL)
             FROM copies cp WHERE cp.book_id = ?1 ORDER BY cp.id",
        )?;
        stmt.query_map([book_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<Result<_, _>>()?
    };
    let mut out = Vec::with_capacity(rows.len());
    for (copy_id, code, loan_id) in rows {
        let (status, loan) = match loan_id {
            None => (CopyState::Available, None),
            Some(lid) => {
                let loan = get(conn, lid, today)?;
                let state = if loan.status == LoanStatus::Overdue {
                    CopyState::Overdue
                } else {
                    CopyState::Loaned
                };
                (
                    state,
                    Some(CopyLoan {
                        id: loan.id,
                        reader: loan.reader,
                        due_at: loan.due_at,
                    }),
                )
            }
        };
        out.push(CopyStatus {
            copy_id,
            code,
            status,
            loan,
        });
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::testutil::{book, db, school, student, today};
    use crate::error::ErrorCode;

    fn copy_id(conn: &Connection, code: &str) -> i64 {
        conn.query_row(
            "SELECT id FROM copies WHERE registration_code = ?1",
            [code],
            |r| r.get(0),
        )
        .unwrap()
    }

    fn input(conn: &Connection, code: &str, student: i64, loaned: &str, due: &str) -> LoanInput {
        LoanInput {
            copy_id: copy_id(conn, code),
            reader_kind: ReaderKind::Student,
            reader_id: student,
            loaned_at: loaned.into(),
            due_at: due.into(),
        }
    }

    #[test]
    fn empresta_e_devolve_marcando_como_lido() {
        let conn = db();
        let (_, _, s) = school(&conn);
        book(&conn, "Dom Casmurro", &["A1"]);
        let loan = create(
            &conn,
            &input(&conn, "A1", s, "2026-10-12", "2026-10-26"),
            today(),
        )
        .unwrap();
        assert_eq!(loan.status, LoanStatus::Active);
        assert_eq!(loan.code, "A1");
        assert_eq!(loan.book.title, "Dom Casmurro");
        assert_eq!(loan.reader.kind, ReaderKind::Student);
        assert_eq!(loan.reader.class_label.as_deref(), Some("5º ano A"));
        assert_eq!(loan.reader.active_loans, 1);

        let done = return_loan(&conn, loan.id, "2026-10-13", true, today()).unwrap();
        assert_eq!(done.status, LoanStatus::Returned);
        assert!(done.marked_read);
        assert_eq!(done.reader.active_loans, 0);
        assert_eq!(
            return_loan(&conn, loan.id, "2026-10-14", true, today())
                .unwrap_err()
                .code,
            ErrorCode::Validation
        );
    }

    #[test]
    fn exemplar_so_tem_um_emprestimo_ativo() {
        let conn = db();
        let (t, _, s) = school(&conn);
        let c1 = crate::db::testutil::class(&conn, "Outra", t);
        let s2 = student(&conn, "Maria", "2026002", c1);
        book(&conn, "Livro", &["A1"]);
        let first = create(
            &conn,
            &input(&conn, "A1", s, "2026-10-01", "2026-10-15"),
            today(),
        )
        .unwrap();
        let err = create(
            &conn,
            &input(&conn, "A1", s2, "2026-10-02", "2026-10-16"),
            today(),
        )
        .unwrap_err();
        assert_eq!(err.code, ErrorCode::CopyUnavailable);
        // depois de devolvido, pode emprestar de novo
        return_loan(&conn, first.id, "2026-10-03", false, today()).unwrap();
        assert!(
            create(
                &conn,
                &input(&conn, "A1", s2, "2026-10-04", "2026-10-18"),
                today()
            )
            .is_ok()
        );
    }

    #[test]
    fn valida_datas_e_leitor() {
        let conn = db();
        let (_, _, s) = school(&conn);
        book(&conn, "Livro", &["A1"]);
        let bad_due = input(&conn, "A1", s, "2026-10-10", "2026-10-01");
        assert_eq!(
            create(&conn, &bad_due, today())
                .unwrap_err()
                .field
                .as_deref(),
            Some("dueAt")
        );
        let bad_fmt = input(&conn, "A1", s, "12/10/2026", "2026-10-20");
        assert_eq!(
            create(&conn, &bad_fmt, today())
                .unwrap_err()
                .field
                .as_deref(),
            Some("loanedAt")
        );
        let ghost = input(&conn, "A1", 999, "2026-10-10", "2026-10-20");
        assert_eq!(
            create(&conn, &ghost, today()).unwrap_err().code,
            ErrorCode::NotFound
        );
        let mut no_copy = input(&conn, "A1", s, "2026-10-10", "2026-10-20");
        no_copy.copy_id = 999;
        assert_eq!(
            create(&conn, &no_copy, today()).unwrap_err().code,
            ErrorCode::NotFound
        );
        let l = create(
            &conn,
            &input(&conn, "A1", s, "2026-10-10", "2026-10-20"),
            today(),
        )
        .unwrap();
        assert_eq!(
            return_loan(&conn, l.id, "2026-10-01", false, today())
                .unwrap_err()
                .field
                .as_deref(),
            Some("returnedAt")
        );
    }

    #[test]
    fn status_calculado_atrasado() {
        let conn = db();
        let (_, _, s) = school(&conn);
        book(&conn, "L1", &["A1"]);
        book(&conn, "L2", &["A2"]);
        book(&conn, "L3", &["A3"]);
        // hoje = 2026-10-12
        let late = create(
            &conn,
            &input(&conn, "A1", s, "2026-09-20", "2026-10-11"),
            today(),
        )
        .unwrap();
        let due_today = create(
            &conn,
            &input(&conn, "A2", s, "2026-09-28", "2026-10-12"),
            today(),
        )
        .unwrap();
        let ok = create(
            &conn,
            &input(&conn, "A3", s, "2026-10-01", "2026-10-30"),
            today(),
        )
        .unwrap();
        assert_eq!(late.status, LoanStatus::Overdue);
        assert_eq!(
            due_today.status,
            LoanStatus::Active,
            "vence hoje não é atraso"
        );
        assert_eq!(ok.status, LoanStatus::Active);
        let late_again = get(&conn, late.id, today()).unwrap();
        assert_eq!(late_again.reader.overdue_loans, 1);
        assert_eq!(late_again.reader.active_loans, 3);
        // o mesmo empréstimo, visto de outro dia
        let tomorrow = NaiveDate::from_ymd_opt(2026, 10, 13).unwrap();
        assert_eq!(
            get(&conn, due_today.id, tomorrow).unwrap().status,
            LoanStatus::Overdue
        );
        // devolvido atrasado vira "returned"
        let r = return_loan(&conn, late.id, "2026-10-12", false, today()).unwrap();
        assert_eq!(r.status, LoanStatus::Returned);
    }

    #[test]
    fn lista_com_abas_contagens_e_ordem() {
        let conn = db();
        let (_, _, s) = school(&conn);
        for (i, due) in ["2026-10-30", "2026-10-05", "2026-10-20"]
            .iter()
            .enumerate()
        {
            book(&conn, &format!("Livro {i}"), &[format!("A{i}").as_str()]);
            create(
                &conn,
                &input(&conn, &format!("A{i}"), s, "2026-09-01", due),
                today(),
            )
            .unwrap();
        }
        let ret = create(
            &conn,
            &{
                book(&conn, "Devolvido", &["Z1"]);
                input(&conn, "Z1", s, "2026-09-01", "2026-09-15")
            },
            today(),
        )
        .unwrap();
        return_loan(&conn, ret.id, "2026-09-10", true, today()).unwrap();

        let q = |status| LoanQuery {
            status: Some(status),
            ..Default::default()
        };
        let active = list(&conn, &q(StatusFilter::Active), today()).unwrap();
        assert_eq!(
            active.counts,
            LoanCounts {
                active: 3,
                overdue: 1,
                returned: 1,
                all: 4
            }
        );
        assert_eq!(active.page.total, 3);
        let dues: Vec<_> = active
            .page
            .items
            .iter()
            .map(|l| l.due_at.as_str())
            .collect();
        assert_eq!(dues, vec!["2026-10-05", "2026-10-20", "2026-10-30"]);
        assert_eq!(
            list(&conn, &q(StatusFilter::Overdue), today())
                .unwrap()
                .page
                .total,
            1
        );
        assert_eq!(
            list(&conn, &q(StatusFilter::Returned), today())
                .unwrap()
                .page
                .total,
            1
        );
        assert_eq!(
            list(&conn, &q(StatusFilter::All), today())
                .unwrap()
                .page
                .total,
            4
        );
        // padrão = ativos
        assert_eq!(
            list(&conn, &LoanQuery::default(), today())
                .unwrap()
                .page
                .total,
            3
        );

        // busca por livro (sem acento), por código e por leitor; counts acompanham a busca
        let by_text = |t: &str| {
            list(
                &conn,
                &LoanQuery {
                    status: Some(StatusFilter::All),
                    text: Some(t.into()),
                    ..Default::default()
                },
                today(),
            )
            .unwrap()
        };
        assert_eq!(by_text("DEVOLVIDO").page.total, 1);
        assert_eq!(by_text("z1").counts.all, 1);
        assert_eq!(by_text("joao").page.total, 4);
        assert_eq!(by_text("ninguem").page.total, 0);
    }

    #[test]
    fn filtros_de_turma_e_tipo_de_leitor() {
        let conn = db();
        let (t, c, s) = school(&conn);
        book(&conn, "L1", &["A1"]);
        book(&conn, "L2", &["A2"]);
        create(
            &conn,
            &input(&conn, "A1", s, "2026-10-01", "2026-10-20"),
            today(),
        )
        .unwrap();
        create(
            &conn,
            &LoanInput {
                copy_id: copy_id(&conn, "A2"),
                reader_kind: ReaderKind::Teacher,
                reader_id: t,
                loaned_at: "2026-10-01".into(),
                due_at: "2026-10-20".into(),
            },
            today(),
        )
        .unwrap();
        let run = |q: LoanQuery| list(&conn, &q, today()).unwrap().page.total;
        assert_eq!(run(LoanQuery::default()), 2);
        assert_eq!(
            run(LoanQuery {
                class_id: Some(c),
                ..Default::default()
            }),
            1
        );
        assert_eq!(
            run(LoanQuery {
                reader_kind: Some(ReaderKind::Teacher),
                ..Default::default()
            }),
            1
        );
        assert_eq!(
            run(LoanQuery {
                reader_kind: Some(ReaderKind::Student),
                ..Default::default()
            }),
            1
        );
    }

    #[test]
    fn status_dos_exemplares() {
        let conn = db();
        let (_, _, s) = school(&conn);
        let b = book(&conn, "Livro", &["A1", "A2", "A3"]);
        create(
            &conn,
            &input(&conn, "A1", s, "2026-09-01", "2026-10-01"),
            today(),
        )
        .unwrap();
        create(
            &conn,
            &input(&conn, "A2", s, "2026-10-01", "2026-10-30"),
            today(),
        )
        .unwrap();
        let st = list_copy_status(&conn, b.id, today()).unwrap();
        let states: Vec<_> = st.iter().map(|c| (c.code.as_str(), c.status)).collect();
        assert_eq!(
            states,
            vec![
                ("A1", CopyState::Overdue),
                ("A2", CopyState::Loaned),
                ("A3", CopyState::Available)
            ]
        );
        assert_eq!(st[0].loan.as_ref().unwrap().reader.name, "João da Silva");
        assert!(st[2].loan.is_none());
        assert_eq!(
            list_copy_status(&conn, 999, today()).unwrap_err().code,
            ErrorCode::NotFound
        );
    }

    #[test]
    fn historico_sobrevive_a_exclusao_do_livro() {
        let conn = db();
        let (_, _, s) = school(&conn);
        let b = book(&conn, "Livro Apagado", &["A1"]);
        let l = create(
            &conn,
            &input(&conn, "A1", s, "2026-10-01", "2026-10-10"),
            today(),
        )
        .unwrap();
        return_loan(&conn, l.id, "2026-10-05", true, today()).unwrap();
        crate::db::books::delete(&conn, b.id).unwrap();
        let after = get(&conn, l.id, today()).unwrap();
        assert_eq!(after.copy_id, None);
        assert_eq!(after.book.id, None);
        assert_eq!(after.book.title, "Livro Apagado");
        assert_eq!(after.code, "A1");
        // continua aparecendo na busca do histórico
        let found = list(
            &conn,
            &LoanQuery {
                status: Some(StatusFilter::Returned),
                text: Some("apagado".into()),
                ..Default::default()
            },
            today(),
        )
        .unwrap();
        assert_eq!(found.page.total, 1);
    }

    fn rename_book(conn: &Connection, id: i64, title: &str, codes: &[&str]) {
        crate::db::books::update(
            conn,
            id,
            &crate::db::books::BookInput {
                title: title.into(),
                author: "Autor Teste".into(),
                subject: "Assunto".into(),
                category_id: crate::db::testutil::category_id(conn, "Romance"),
                codes: codes.iter().map(|c| c.to_string()).collect(),
            },
        )
        .unwrap();
    }

    fn search(conn: &Connection, text: &str) -> i64 {
        list(
            conn,
            &LoanQuery {
                status: Some(StatusFilter::All),
                text: Some(text.into()),
                ..Default::default()
            },
            today(),
        )
        .unwrap()
        .page
        .total
    }

    #[test]
    fn emprestimo_ativo_mostra_titulo_atual_apos_editar_o_livro() {
        let conn = db();
        let (_, _, s) = school(&conn);
        let b = book(&conn, "Dom Casmuro", &["A1"]);
        let l = create(
            &conn,
            &input(&conn, "A1", s, "2026-10-01", "2026-10-15"),
            today(),
        )
        .unwrap();
        assert_eq!(l.book.id, Some(b.id));
        assert_eq!(search(&conn, "casmuro"), 1);

        rename_book(&conn, b.id, "Dom Casmurro", &["A1"]);
        let after = get(&conn, l.id, today()).unwrap();
        assert_eq!(after.book.title, "Dom Casmurro");
        assert_eq!(after.book.id, Some(b.id));
        assert_eq!(search(&conn, "casmurro"), 1);

        // o snapshot também foi atualizado (fica coerente para quando o livro for apagado)
        let (snap_title, snap_norm): (String, String) = conn
            .query_row(
                "SELECT book_title, book_norm FROM loans WHERE id = ?1",
                [l.id],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(snap_title, "Dom Casmurro");
        assert_eq!(snap_norm, "dom casmurro autor teste");

        // enquanto book_id existir, vale o JOIN, mesmo com snapshot defasado
        conn.execute(
            "UPDATE loans SET book_title = 'velho', book_norm = 'velho'",
            [],
        )
        .unwrap();
        assert_eq!(
            get(&conn, l.id, today()).unwrap().book.title,
            "Dom Casmurro"
        );
        assert_eq!(search(&conn, "velho"), 0);
        assert_eq!(search(&conn, "casmurro"), 1);
    }

    #[test]
    fn historico_mantem_o_livro_ao_remover_o_codigo() {
        let conn = db();
        let (_, _, s) = school(&conn);
        let b = book(&conn, "Livro Vivo", &["A1", "A2"]);
        let l = create(
            &conn,
            &input(&conn, "A1", s, "2026-10-01", "2026-10-15"),
            today(),
        )
        .unwrap();
        return_loan(&conn, l.id, "2026-10-03", true, today()).unwrap();
        rename_book(&conn, b.id, "Livro Vivo Editado", &["A2"]);
        let after = get(&conn, l.id, today()).unwrap();
        assert_eq!(after.copy_id, None);
        assert_eq!(after.code, "A1");
        assert_eq!(after.book.id, Some(b.id), "o livro ainda existe");
        assert_eq!(after.book.title, "Livro Vivo Editado");

        // só quando o livro é apagado o vínculo vira nulo e o snapshot assume
        crate::db::books::delete(&conn, b.id).unwrap();
        let gone = get(&conn, l.id, today()).unwrap();
        assert_eq!(gone.book.id, None);
        assert_eq!(gone.book.title, "Livro Vivo Editado");
        assert_eq!(search(&conn, "editado"), 1);
    }

    #[test]
    fn livros_lidos_contam_livros_distintos() {
        let conn = db();
        let (t, _, s) = school(&conn);
        let a = book(&conn, "Livro A", &["A1", "A2"]);
        book(&conn, "Livro B", &["B1"]);
        book(&conn, "Livro C", &["C1"]);
        let read = |code: &str, mark: bool| {
            let l = create(
                &conn,
                &input(&conn, code, s, "2026-10-01", "2026-10-15"),
                today(),
            )
            .unwrap();
            return_loan(&conn, l.id, "2026-10-02", mark, today()).unwrap();
        };
        let count = || {
            crate::db::students::get(&conn, s, today())
                .unwrap()
                .read_count
        };
        read("A1", true);
        read("A2", true); // outro exemplar do mesmo livro
        assert_eq!(count(), 1, "o mesmo livro lido duas vezes conta uma vez");
        read("B1", true);
        read("C1", false); // devolvido sem marcar como lido
        assert_eq!(count(), 2);
        let summary =
            crate::db::readers::get_reader_summary(&conn, ReaderKind::Student, s, today()).unwrap();
        assert_eq!(summary.counts.read, 2);

        // livro apagado: cai para o título normalizado do snapshot, sem dupla contagem
        crate::db::books::delete(&conn, a.id).unwrap();
        assert_eq!(count(), 2);

        // professores seguem a mesma regra
        let tl = |code: &str| {
            let copy = copy_id(&conn, code);
            let l = create(
                &conn,
                &LoanInput {
                    copy_id: copy,
                    reader_kind: ReaderKind::Teacher,
                    reader_id: t,
                    loaned_at: "2026-10-05".into(),
                    due_at: "2026-10-20".into(),
                },
                today(),
            )
            .unwrap();
            return_loan(&conn, l.id, "2026-10-06", true, today()).unwrap();
        };
        tl("B1");
        tl("B1");
        assert_eq!(
            crate::db::teachers::get(&conn, t, today())
                .unwrap()
                .read_count,
            1
        );
    }

    #[test]
    fn busca_de_codigo_e_matricula_ignora_acento_e_caixa() {
        let conn = db();
        let (_, c, _) = school(&conn);
        let b = book(&conn, "Livro Codigo", &["Á-01"]);
        let hit = |text: &str| {
            crate::db::books::list(
                &conn,
                &crate::db::books::BookQuery {
                    text: Some(text.into()),
                    ..Default::default()
                },
            )
            .unwrap()
            .items
            .iter()
            .any(|x| x.id == b.id)
        };
        assert!(hit("a-01"));
        assert!(hit("Á-01"));
        assert!(!hit("a-02"));

        student(&conn, "Ñandú Teste", "MÃE-7", c);
        let found = |text: &str| {
            crate::db::students::list(
                &conn,
                &crate::db::students::StudentQuery {
                    text: Some(text.into()),
                    ..Default::default()
                },
                today(),
            )
            .unwrap()
            .total
        };
        assert_eq!(found("mae-7"), 1);
        assert_eq!(found("MÃE"), 1);
        assert_eq!(
            crate::db::readers::search_readers(&conn, "mae-7", None, today())
                .unwrap()
                .len(),
            1
        );
    }

    #[test]
    fn datas_de_criacao_saem_em_iso_8601_utc() {
        let conn = db();
        let (_, _, s) = school(&conn);
        let is_iso = |v: &str| {
            let b = v.as_bytes();
            v.len() == 20
                && v.ends_with('Z')
                && b[4] == b'-'
                && b[7] == b'-'
                && b[10] == b'T'
                && b[13] == b':'
                && b[16] == b':'
        };
        let bk = book(&conn, "Livro Data", &["D1"]);
        assert!(is_iso(&bk.created_at), "{}", bk.created_at);
        assert!(is_iso(&bk.updated_at), "{}", bk.updated_at);
        let st = crate::db::students::get(&conn, s, today()).unwrap();
        assert!(is_iso(&st.created_at), "{}", st.created_at);
        let recent = crate::db::books::recent(&conn, 5).unwrap();
        assert!(is_iso(&recent[0].created_at));
        let v = serde_json::to_value(&bk).unwrap();
        assert!(v["createdAt"].as_str().unwrap().ends_with('Z'));
    }

    #[test]
    fn serializa_no_formato_do_contrato() {
        let conn = db();
        let (_, _, s) = school(&conn);
        book(&conn, "Livro", &["A1"]);
        create(
            &conn,
            &input(&conn, "A1", s, "2026-10-01", "2026-10-20"),
            today(),
        )
        .unwrap();
        let page = list(&conn, &LoanQuery::default(), today()).unwrap();
        let v = serde_json::to_value(&page).unwrap();
        assert_eq!(v["total"], 1);
        assert_eq!(v["pageSize"], 20);
        assert_eq!(v["counts"]["active"], 1);
        let item = &v["items"][0];
        assert_eq!(item["status"], "active");
        assert_eq!(item["reader"]["kind"], "student");
        assert_eq!(item["reader"]["classLabel"], "5º ano A");
        assert_eq!(item["markedRead"], false);
        assert!(item.get("returnedAt").is_none());
        assert!(item["book"]["id"].is_number());
    }
}
