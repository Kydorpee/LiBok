//! Repositório de livros e exemplares.

use super::normalize::{like_tokens, normalize};
use super::types::Page;
use super::{Filter, map_write_err, paging, require, utc_iso};
use crate::error::{AppError, AppResult};
use rusqlite::types::Value;
use rusqlite::{Connection, OptionalExtension, params, params_from_iter};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRef {
    pub id: i64,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: i64,
    pub title: String,
    pub author: String,
    pub subject: String,
    pub category: CategoryRef,
    pub codes: Vec<String>,
    pub quantity: i64,
    pub available_count: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookInput {
    pub title: String,
    pub author: String,
    pub subject: String,
    pub category_id: i64,
    pub codes: Vec<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Availability {
    #[default]
    All,
    Available,
    Unavailable,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BookSort {
    #[default]
    Title,
    Author,
    CreatedAt,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SortDir {
    #[default]
    Asc,
    Desc,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct BookQuery {
    pub text: Option<String>,
    pub category_id: Option<i64>,
    pub availability: Option<Availability>,
    pub sort: Option<BookSort>,
    pub dir: Option<SortDir>,
    pub page: Option<i64>,
    pub page_size: Option<i64>,
}

/// Exemplares do livro sem empréstimo ativo.
const AVAILABLE_EXPR: &str = "(SELECT COUNT(*) FROM copies cp WHERE cp.book_id = b.id
        AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = cp.id AND l.returned_at IS NULL))";

fn select_sql() -> String {
    format!(
        "SELECT b.id, b.title, b.author, b.subject, b.category_id, c.name, c.color,
            {}, {},
            (SELECT COUNT(*) FROM copies cp WHERE cp.book_id = b.id),
            (SELECT COUNT(*) FROM copies cp WHERE cp.book_id = b.id
                AND NOT EXISTS (SELECT 1 FROM loans l WHERE l.copy_id = cp.id AND l.returned_at IS NULL))
         FROM books b JOIN categories c ON c.id = b.category_id",
        utc_iso("b.created_at"),
        utc_iso("b.updated_at")
    )
}

fn map_book(row: &rusqlite::Row<'_>) -> rusqlite::Result<Book> {
    Ok(Book {
        id: row.get(0)?,
        title: row.get(1)?,
        author: row.get(2)?,
        subject: row.get(3)?,
        category: CategoryRef {
            id: row.get(4)?,
            name: row.get(5)?,
            color: row.get(6)?,
        },
        codes: Vec::new(),
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
        quantity: row.get(9)?,
        available_count: row.get(10)?,
    })
}

fn fill_codes(conn: &Connection, book: &mut Book) -> AppResult<()> {
    let mut stmt =
        conn.prepare_cached("SELECT registration_code FROM copies WHERE book_id = ?1 ORDER BY id")?;
    book.codes = stmt
        .query_map([book.id], |r| r.get(0))?
        .collect::<Result<Vec<String>, _>>()?;
    Ok(())
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Book> {
    let mut book = conn
        .query_row(&format!("{} WHERE b.id = ?1", select_sql()), [id], map_book)
        .optional()?
        .ok_or_else(|| AppError::not_found("Livro não encontrado."))?;
    fill_codes(conn, &mut book)?;
    Ok(book)
}

/// Últimos livros cadastrados.
pub fn recent(conn: &Connection, limit: i64) -> AppResult<Vec<Book>> {
    let mut stmt = conn.prepare(&format!(
        "{} ORDER BY b.created_at DESC, b.id DESC LIMIT ?1",
        select_sql()
    ))?;
    let mut books = stmt
        .query_map([limit], map_book)?
        .collect::<Result<Vec<_>, _>>()?;
    for b in &mut books {
        fill_codes(conn, b)?;
    }
    Ok(books)
}

/// Busca paginada (texto sem acento/caixa em título, autor, assunto, categoria e código).
pub fn list(conn: &Connection, query: &BookQuery) -> AppResult<Page<Book>> {
    let mut filter = Filter::new();
    if let Some(text) = query.text.as_deref() {
        for token in like_tokens(text) {
            filter.push(
                "(b.title_norm LIKE ? ESCAPE '\\' OR b.author_norm LIKE ? ESCAPE '\\'
                  OR b.subject_norm LIKE ? ESCAPE '\\' OR c.name_norm LIKE ? ESCAPE '\\'
                  OR EXISTS (SELECT 1 FROM copies cx WHERE cx.book_id = b.id
                             AND libok_norm(cx.registration_code) LIKE ? ESCAPE '\\'))",
                vec![Value::Text(token); 5],
            );
        }
    }
    if let Some(cat) = query.category_id {
        filter.push("b.category_id = ?", vec![Value::Integer(cat)]);
    }
    match query.availability.unwrap_or_default() {
        Availability::All => {}
        Availability::Available => filter.push(format!("{AVAILABLE_EXPR} > 0"), vec![]),
        Availability::Unavailable => filter.push(format!("{AVAILABLE_EXPR} = 0"), vec![]),
    }

    let where_sql = filter.where_sql();
    let total: i64 = conn.query_row(
        &format!(
            "SELECT COUNT(*) FROM books b JOIN categories c ON c.id = b.category_id{where_sql}"
        ),
        params_from_iter(filter.params_with(vec![]).iter()),
        |r| r.get(0),
    )?;

    let column = match query.sort.unwrap_or_default() {
        BookSort::Title => "b.title_norm",
        BookSort::Author => "b.author_norm",
        BookSort::CreatedAt => "b.created_at",
    };
    let dir = match query.dir.unwrap_or_default() {
        SortDir::Asc => "ASC",
        SortDir::Desc => "DESC",
    };
    let (page, page_size, offset) = paging(query.page, query.page_size);
    let sql = format!(
        "{}{where_sql} ORDER BY {column} {dir}, b.id {dir} LIMIT ? OFFSET ?",
        select_sql()
    );
    let values = filter.params_with(vec![Value::Integer(page_size), Value::Integer(offset)]);
    let mut stmt = conn.prepare(&sql)?;
    let mut items = stmt
        .query_map(params_from_iter(values.iter()), map_book)?
        .collect::<Result<Vec<_>, _>>()?;
    for b in &mut items {
        fill_codes(conn, b)?;
    }
    Ok(Page {
        items,
        total,
        page,
        page_size,
    })
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

/// Valida e limpa a entrada (trim, obrigatórios, categoria existente, códigos únicos na lista).
pub(crate) fn clean_input(conn: &Connection, input: &BookInput) -> AppResult<BookInput> {
    let title = require("title", "o título", &input.title)?;
    let author = require("author", "o autor", &input.author)?;
    let subject = require("subject", "o assunto", &input.subject)?;
    let category_exists: bool = conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM categories WHERE id = ?1)",
        [input.category_id],
        |r| r.get(0),
    )?;
    if !category_exists {
        return Err(AppError::validation(
            "categoryId",
            "Selecione uma categoria.",
        ));
    }
    let codes: Vec<String> = input
        .codes
        .iter()
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty())
        .collect();
    if codes.is_empty() {
        return Err(AppError::validation(
            "codes",
            "Informe ao menos um código de registro.",
        ));
    }
    let mut seen = HashSet::new();
    for (i, code) in codes.iter().enumerate() {
        if !seen.insert(code.to_lowercase()) {
            return Err(AppError::duplicate_code(format!(
                "O código {code} está repetido na lista."
            ))
            .with_field(format!("codes.{i}")));
        }
    }
    Ok(BookInput {
        title,
        author,
        subject,
        category_id: input.category_id,
        codes,
    })
}

/// `true` se já existe livro com esse título normalizado (exceto `except_id`).
pub(crate) fn title_exists(
    conn: &Connection,
    title_norm: &str,
    except_id: Option<i64>,
) -> AppResult<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM books WHERE title_norm = ?1 AND id IS NOT ?2)",
        params![title_norm, except_id],
        |r| r.get(0),
    )?)
}

/// `true` se o código já existe em algum exemplar (sem diferenciar caixa).
pub(crate) fn code_exists(conn: &Connection, code: &str) -> AppResult<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM copies WHERE lower(registration_code) = lower(?1))",
        [code],
        |r| r.get(0),
    )?)
}

fn ensure_title_free(conn: &Connection, title: &str, except_id: Option<i64>) -> AppResult<()> {
    if title_exists(conn, &normalize(title), except_id)? {
        return Err(AppError::duplicate_title(
            "Já existe um livro cadastrado com esse título.",
        ));
    }
    Ok(())
}

fn ensure_code_free(conn: &Connection, code: &str, index: usize) -> AppResult<()> {
    if code_exists(conn, code)? {
        return Err(AppError::duplicate_code(format!(
            "O código de registro {code} já está cadastrado."
        ))
        .with_field(format!("codes.{index}")));
    }
    Ok(())
}

fn copy_has_active_loan(conn: &Connection, copy_id: i64) -> AppResult<bool> {
    Ok(conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM loans WHERE copy_id = ?1 AND returned_at IS NULL)",
        [copy_id],
        |r| r.get(0),
    )?)
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------

/// Insere livro + exemplares já validados (sem transação própria: o chamador abre).
pub(crate) fn insert_in(conn: &Connection, clean: &BookInput) -> AppResult<i64> {
    ensure_title_free(conn, &clean.title, None)?;
    for (i, code) in clean.codes.iter().enumerate() {
        ensure_code_free(conn, code, i)?;
    }
    conn.execute(
        "INSERT INTO books (title, title_norm, author, author_norm, subject, subject_norm, category_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            clean.title,
            normalize(&clean.title),
            clean.author,
            normalize(&clean.author),
            clean.subject,
            normalize(&clean.subject),
            clean.category_id
        ],
    )
    .map_err(map_write_err)?;
    let id = conn.last_insert_rowid();
    for code in &clean.codes {
        conn.execute(
            "INSERT INTO copies (book_id, registration_code) VALUES (?1, ?2)",
            params![id, code],
        )
        .map_err(map_write_err)?;
    }
    Ok(id)
}

pub fn create(conn: &Connection, input: &BookInput) -> AppResult<Book> {
    let clean = clean_input(conn, input)?;
    let tx = conn.unchecked_transaction()?;
    let id = insert_in(&tx, &clean)?;
    tx.commit()?;
    get(conn, id)
}

/// Atualiza o livro fazendo diff dos códigos: os que continuam mantêm o
/// `copies.id` (e portanto o vínculo com empréstimos).
pub fn update(conn: &Connection, id: i64, input: &BookInput) -> AppResult<Book> {
    get(conn, id)?;
    let clean = clean_input(conn, input)?;
    let tx = conn.unchecked_transaction()?;
    ensure_title_free(&tx, &clean.title, Some(id))?;

    let existing: Vec<(i64, String)> = {
        let mut stmt = tx.prepare("SELECT id, registration_code FROM copies WHERE book_id = ?1")?;
        stmt.query_map([id], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<Result<_, _>>()?
    };

    for (copy_id, code) in &existing {
        if !clean.codes.contains(code) {
            if copy_has_active_loan(&tx, *copy_id)? {
                return Err(AppError::has_active_loans(format!(
                    "O código {code} está emprestado e não pode ser removido nem renomeado."
                ))
                .with_field("codes"));
            }
            tx.execute("DELETE FROM copies WHERE id = ?1", [copy_id])?;
        }
    }
    for (i, code) in clean.codes.iter().enumerate() {
        if !existing.iter().any(|(_, c)| c == code) {
            ensure_code_free(&tx, code, i)?;
            tx.execute(
                "INSERT INTO copies (book_id, registration_code) VALUES (?1, ?2)",
                params![id, code],
            )
            .map_err(map_write_err)?;
        }
    }
    tx.execute(
        "UPDATE books SET title = ?1, title_norm = ?2, author = ?3, author_norm = ?4,
             subject = ?5, subject_norm = ?6, category_id = ?7, updated_at = datetime('now')
         WHERE id = ?8",
        params![
            clean.title,
            normalize(&clean.title),
            clean.author,
            normalize(&clean.author),
            clean.subject,
            normalize(&clean.subject),
            clean.category_id,
            id
        ],
    )
    .map_err(map_write_err)?;
    // Mantém o snapshot dos empréstimos coerente com o livro editado.
    tx.execute(
        "UPDATE loans SET book_title = ?1, book_author = ?2, book_norm = ?3 WHERE book_id = ?4",
        params![
            clean.title,
            clean.author,
            normalize(&format!("{} {}", clean.title, clean.author)),
            id
        ],
    )?;
    tx.commit()?;
    get(conn, id)
}

/// Exclui o livro e seus exemplares; o histórico de empréstimos permanece (snapshot).
pub fn delete(conn: &Connection, id: i64) -> AppResult<()> {
    get(conn, id)?;
    let tx = conn.unchecked_transaction()?;
    let active: i64 = tx.query_row(
        "SELECT COUNT(*) FROM loans l JOIN copies cp ON cp.id = l.copy_id
         WHERE cp.book_id = ?1 AND l.returned_at IS NULL",
        [id],
        |r| r.get(0),
    )?;
    if active > 0 {
        return Err(AppError::has_active_loans(
            "Este livro tem exemplares emprestados; registre a devolução antes de excluir.",
        ));
    }
    tx.execute("DELETE FROM books WHERE id = ?1", [id])?;
    tx.commit()?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::loans::{self, LoanInput};
    use crate::db::testutil::{book, category_id, db, school, today};
    use crate::db::types::ReaderKind;
    use crate::error::ErrorCode;

    fn input(title: &str, codes: &[&str]) -> BookInput {
        BookInput {
            title: title.into(),
            author: "Machado de Assis".into(),
            subject: "Romance brasileiro".into(),
            category_id: 1,
            codes: codes.iter().map(|c| c.to_string()).collect(),
        }
    }

    fn lend(conn: &Connection, copy_id: i64, student: i64) -> i64 {
        loans::create(
            conn,
            &LoanInput {
                copy_id,
                reader_kind: ReaderKind::Student,
                reader_id: student,
                loaned_at: "2026-10-01".into(),
                due_at: "2026-10-15".into(),
            },
            today(),
        )
        .unwrap()
        .id
    }

    fn q(text: &str) -> BookQuery {
        BookQuery {
            text: Some(text.into()),
            ..Default::default()
        }
    }

    #[test]
    fn cria_e_le_livro() {
        let conn = db();
        let b = create(&conn, &input("  Dom Casmurro ", &["A1", " A2 "])).unwrap();
        assert_eq!(b.title, "Dom Casmurro");
        assert_eq!(b.codes, vec!["A1", "A2"]);
        assert_eq!((b.quantity, b.available_count), (2, 2));
        assert_eq!(get(&conn, b.id).unwrap(), b);
    }

    #[test]
    fn valida_obrigatorios() {
        let conn = db();
        let mut i = input("", &["A1"]);
        assert_eq!(
            create(&conn, &i).unwrap_err().field.as_deref(),
            Some("title")
        );
        i = input("X", &[]);
        assert_eq!(
            create(&conn, &i).unwrap_err().field.as_deref(),
            Some("codes")
        );
        i = input("X", &["  "]);
        assert_eq!(create(&conn, &i).unwrap_err().code, ErrorCode::Validation);
        i = input("X", &["A1"]);
        i.category_id = 9999;
        assert_eq!(
            create(&conn, &i).unwrap_err().field.as_deref(),
            Some("categoryId")
        );
    }

    #[test]
    fn titulo_duplicado_ignora_caixa_acento_e_espacos() {
        let conn = db();
        create(&conn, &input("A História do Brasil", &["A1"])).unwrap();
        let err = create(&conn, &input("  a historia DO brasil ", &["A2"])).unwrap_err();
        assert_eq!(err.code, ErrorCode::DuplicateTitle);
    }

    #[test]
    fn codigo_duplicado_entre_livros_e_na_lista() {
        let conn = db();
        create(&conn, &input("Livro 1", &["A1"])).unwrap();
        let err = create(&conn, &input("Livro 2", &["a1"])).unwrap_err();
        assert_eq!(err.code, ErrorCode::DuplicateCode);
        let err = create(&conn, &input("Livro 3", &["B1", "B1"])).unwrap_err();
        assert_eq!(err.code, ErrorCode::DuplicateCode);
        // nada foi gravado pelas tentativas falhas
        assert_eq!(list(&conn, &BookQuery::default()).unwrap().total, 1);
    }

    #[test]
    fn falha_no_meio_nao_deixa_livro_pela_metade() {
        let conn = db();
        create(&conn, &input("Livro 1", &["A1"])).unwrap();
        assert!(create(&conn, &input("Livro 2", &["B1", "A1"])).is_err());
        let books: i64 = conn
            .query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))
            .unwrap();
        assert_eq!(books, 1);
    }

    #[test]
    fn busca_com_e_sem_acento() {
        let conn = db();
        create(&conn, &input("História do Brasil", &["H1"])).unwrap();
        create(&conn, &input("Outro", &["O1"])).unwrap();
        for t in ["historia", "HISTÓRIA", "  hist  ", "brasil historia"] {
            let p = list(&conn, &q(t)).unwrap();
            assert_eq!(p.total, 1, "texto: {t}");
            assert_eq!(p.items[0].title, "História do Brasil");
        }
        assert_eq!(list(&conn, &q("nao existe")).unwrap().total, 0);
    }

    #[test]
    fn busca_por_autor_assunto_categoria_e_codigo() {
        let conn = db();
        let mut i = input("Livro", &["REG-001"]);
        i.category_id = category_id(&conn, "Ficção");
        create(&conn, &i).unwrap();
        for t in ["machado", "brasileiro", "ficcao", "reg-001", "reg"] {
            assert_eq!(list(&conn, &q(t)).unwrap().total, 1, "texto: {t}");
        }
    }

    #[test]
    fn busca_trata_curingas_como_texto() {
        let conn = db();
        create(&conn, &input("100% Java", &["J1"])).unwrap();
        create(&conn, &input("Outro", &["O1"])).unwrap();
        assert_eq!(list(&conn, &q("100%")).unwrap().total, 1);
        assert_eq!(list(&conn, &q("%")).unwrap().total, 1);
        assert_eq!(list(&conn, &q("_")).unwrap().total, 0);
    }

    #[test]
    fn filtro_categoria_ordenacao_e_paginacao() {
        let conn = db();
        let fic = category_id(&conn, "Ficção");
        for (i, t) in ["Beta", "Alfa", "Gama"].iter().enumerate() {
            let mut inp = input(t, &[format!("C{i}").as_str()]);
            inp.category_id = if i == 0 { fic } else { 1 };
            create(&conn, &inp).unwrap();
        }
        let by_cat = list(
            &conn,
            &BookQuery {
                category_id: Some(fic),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(by_cat.total, 1);

        let page1 = list(
            &conn,
            &BookQuery {
                page: Some(1),
                page_size: Some(2),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(page1.total, 3);
        let titles: Vec<_> = page1.items.iter().map(|b| b.title.as_str()).collect();
        assert_eq!(titles, vec!["Alfa", "Beta"]);

        let desc = list(
            &conn,
            &BookQuery {
                dir: Some(SortDir::Desc),
                page: Some(2),
                page_size: Some(2),
                ..Default::default()
            },
        )
        .unwrap();
        assert_eq!(desc.items.len(), 1);
        assert_eq!(desc.items[0].title, "Alfa");
    }

    #[test]
    fn disponibilidade_e_available_count() {
        let conn = db();
        let (_, _, student) = school(&conn);
        let a = book(&conn, "Livro A", &["A1", "A2"]);
        let b = book(&conn, "Livro B", &["B1"]);
        lend(&conn, b.id_of_copy(&conn, "B1"), student);
        lend(&conn, a.id_of_copy(&conn, "A1"), student);

        assert_eq!(get(&conn, a.id).unwrap().available_count, 1);
        assert_eq!(get(&conn, b.id).unwrap().available_count, 0);

        let avail = |av| {
            list(
                &conn,
                &BookQuery {
                    availability: Some(av),
                    ..Default::default()
                },
            )
            .unwrap()
        };
        let available = avail(Availability::Available);
        assert_eq!(available.total, 1);
        assert_eq!(available.items[0].title, "Livro A");
        let unavailable = avail(Availability::Unavailable);
        assert_eq!(unavailable.total, 1);
        assert_eq!(unavailable.items[0].title, "Livro B");
        assert_eq!(avail(Availability::All).total, 2);
    }

    #[test]
    fn update_faz_diff_e_preserva_emprestimo() {
        let conn = db();
        let (_, _, student) = school(&conn);
        let b = book(&conn, "Livro", &["A1", "A2"]);
        let a1 = b.id_of_copy(&conn, "A1");
        let loan_id = lend(&conn, a1, student);

        let mut inp = input("Livro Editado", &["A1", "A3"]);
        inp.category_id = category_id(&conn, "Romance");
        let updated = update(&conn, b.id, &inp).unwrap();
        assert_eq!(updated.title, "Livro Editado");
        assert_eq!(updated.codes, vec!["A1", "A3"]);
        // A1 manteve o mesmo copies.id e o empréstimo continua ligado a ele
        assert_eq!(updated.id_of_copy(&conn, "A1"), a1);
        let copy_of_loan: Option<i64> = conn
            .query_row("SELECT copy_id FROM loans WHERE id = ?1", [loan_id], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(copy_of_loan, Some(a1));
        assert_eq!(updated.available_count, 1);
    }

    #[test]
    fn update_bloqueia_remover_ou_renomear_codigo_emprestado() {
        let conn = db();
        let (_, _, student) = school(&conn);
        let b = book(&conn, "Livro", &["A1", "A2"]);
        lend(&conn, b.id_of_copy(&conn, "A1"), student);

        let err = update(&conn, b.id, &input("Livro", &["A2"])).unwrap_err();
        assert_eq!(err.code, ErrorCode::HasActiveLoans);
        let err = update(&conn, b.id, &input("Livro", &["A1-novo", "A2"])).unwrap_err();
        assert_eq!(err.code, ErrorCode::HasActiveLoans);
        // rollback: nada mudou
        assert_eq!(get(&conn, b.id).unwrap().codes, vec!["A1", "A2"]);
    }

    #[test]
    fn update_valida_titulo_e_codigo_de_outros_livros() {
        let conn = db();
        book(&conn, "Livro 1", &["A1"]);
        let b2 = book(&conn, "Livro 2", &["B1"]);
        assert_eq!(
            update(&conn, b2.id, &input("livro 1", &["B1"]))
                .unwrap_err()
                .code,
            ErrorCode::DuplicateTitle
        );
        assert_eq!(
            update(&conn, b2.id, &input("Livro 2", &["B1", "A1"]))
                .unwrap_err()
                .code,
            ErrorCode::DuplicateCode
        );
        // manter o próprio título/código é permitido
        assert!(update(&conn, b2.id, &input("LIVRO 2", &["B1"])).is_ok());
        assert_eq!(
            update(&conn, 999, &input("X", &["Z"])).unwrap_err().code,
            ErrorCode::NotFound
        );
    }

    #[test]
    fn delete_remove_exemplares_em_cascata() {
        let conn = db();
        let b = book(&conn, "Livro", &["A1", "A2"]);
        delete(&conn, b.id).unwrap();
        let copies: i64 = conn
            .query_row("SELECT COUNT(*) FROM copies", [], |r| r.get(0))
            .unwrap();
        assert_eq!(copies, 0);
        assert_eq!(delete(&conn, b.id).unwrap_err().code, ErrorCode::NotFound);
    }

    #[test]
    fn delete_bloqueado_com_emprestimo_ativo() {
        let conn = db();
        let (_, _, student) = school(&conn);
        let b = book(&conn, "Livro", &["A1"]);
        let loan = lend(&conn, b.id_of_copy(&conn, "A1"), student);
        assert_eq!(
            delete(&conn, b.id).unwrap_err().code,
            ErrorCode::HasActiveLoans
        );
        // após devolver, pode excluir e o histórico mantém o snapshot
        loans::return_loan(&conn, loan, "2026-10-05", true, today()).unwrap();
        delete(&conn, b.id).unwrap();
        let (title, copy): (String, Option<i64>) = conn
            .query_row(
                "SELECT book_title, copy_id FROM loans WHERE id = ?1",
                [loan],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(title, "Livro");
        assert_eq!(copy, None);
    }

    #[test]
    fn recentes_vem_do_mais_novo() {
        let conn = db();
        book(&conn, "Primeiro", &["A1"]);
        book(&conn, "Segundo", &["A2"]);
        let r = recent(&conn, 5).unwrap();
        assert_eq!(r[0].title, "Segundo");
    }

    impl Book {
        /// Auxiliar de testes: `copies.id` do código informado.
        fn id_of_copy(&self, conn: &Connection, code: &str) -> i64 {
            conn.query_row(
                "SELECT id FROM copies WHERE registration_code = ?1",
                [code],
                |r| r.get(0),
            )
            .unwrap()
        }
    }
}
