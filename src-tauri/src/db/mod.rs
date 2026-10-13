//! Camada de banco — área do libok-sqlite-db: conexão, migrations,
//! repositórios, normalização, CSV e backup.
//!
//! Todo SQL do aplicativo vive aqui. Os repositórios são funções puras que
//! recebem `&Connection` (ou `&mut Connection` quando precisam substituir o
//! banco). Funções que dependem de "hoje" recebem a data como parâmetro.

pub mod backup;
pub mod books;
pub mod categories;
pub mod classes;
pub mod csv;
pub mod loans;
pub mod normalize;
pub mod readers;
pub mod readings;
pub mod stats;
pub mod students;
pub mod teachers;
pub mod types;

use crate::error::{AppError, AppResult};
use chrono::NaiveDate;
use rusqlite::Connection;
use rusqlite::types::Value;
use rusqlite_migration::{M, Migrations};
use std::path::Path;

/// Versão (`PRAGMA user_version`) do schema produzido pelas migrations atuais.
/// Deve ser incrementada a cada nova migration.
pub const SCHEMA_VERSION: i32 = 4;

// Regras para novas migrations (F-16)
// -----------------------------------
// `open` liga `PRAGMA foreign_keys = ON` ANTES de migrar, e o SQLite ignora
// esse PRAGMA dentro de uma transação (as migrations rodam em transação).
// Consequências:
// * `ALTER TABLE ... ADD COLUMN` (coluna nula, com ou sem REFERENCES) e
//   `CREATE INDEX` são seguros: não recriam a tabela (padrão da 0002).
// * A 0004 recria tabelas: por isso `migrate` desliga as FKs fora da transação.
// * NUNCA recrie uma tabela (`DROP TABLE` / `RENAME` / `CREATE TABLE novo ...
//   INSERT SELECT`) numa migration normal: com FKs ligadas o `DROP TABLE` faz
//   `DELETE` implícito e dispara `ON DELETE CASCADE` / `SET NULL` nas tabelas
//   filhas (ex.: apagaria o histórico de `loans`).
// * Se for inevitável recriar uma tabela: ligar `foreign_keys = OFF` fora da
//   transação (antes de `to_latest`, só para essa versão), recriar, rodar
//   `PRAGMA foreign_key_check` e religar. O `restore` também passa por aqui.
fn migrations() -> Migrations<'static> {
    Migrations::new(vec![
        M::up(include_str!("../../migrations/0001_init.sql")),
        M::up(include_str!("../../migrations/0002_loan_book_id.sql")),
        M::up(include_str!("../../migrations/0003_class_readings.sql")),
        // Recria `students` e `class_readings`: exige foreign_keys=OFF (ver `migrate`).
        M::up(include_str!("../../migrations/0004_optional_class.sql")).foreign_key_check(),
    ])
}

/// Primeira versão cuja migration recria tabelas (precisa de `foreign_keys = OFF`).
const FIRST_TABLE_REBUILD: i32 = 4;

/// Aplica todas as migrations pendentes.
///
/// Quando alguma pendente recria tabelas (0004), `foreign_keys` é desligado
/// FORA da transação, as migrations rodam (com `foreign_key_check` antes do
/// commit) e o valor anterior do PRAGMA é restaurado, mesmo em caso de erro.
pub fn migrate(conn: &mut Connection) -> AppResult<()> {
    let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version >= FIRST_TABLE_REBUILD {
        migrations().to_latest(conn)?;
        return Ok(());
    }
    let fk_before: i64 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?;
    conn.pragma_update(None, "foreign_keys", "OFF")?;
    let result = migrations().to_latest(conn);
    conn.pragma_update(
        None,
        "foreign_keys",
        if fk_before == 1 { "ON" } else { "OFF" },
    )?;
    result?;
    Ok(())
}

/// PRAGMAs de toda conexão (briefing §4).
pub(crate) fn apply_pragmas(conn: &Connection, wal: bool) -> AppResult<()> {
    if wal {
        conn.pragma_update(None, "journal_mode", "WAL")?;
    }
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.busy_timeout(std::time::Duration::from_secs(5))?;
    register_functions(conn)?;
    Ok(())
}

/// Funções SQL próprias: `libok_norm(texto)` aplica a mesma normalização do Rust
/// (usada na busca por código/matrícula, sem coluna `*_norm` extra).
fn register_functions(conn: &Connection) -> AppResult<()> {
    use rusqlite::functions::FunctionFlags;
    conn.create_scalar_function(
        "libok_norm",
        1,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| {
            let value: Option<String> = ctx.get(0)?;
            Ok(value.map(|v| normalize::normalize(&v)))
        },
    )?;
    Ok(())
}

/// Expressão SQL que converte `YYYY-MM-DD HH:MM:SS` (UTC, `datetime('now')`)
/// em ISO 8601 com `Z`.
pub(crate) fn utc_iso(column: &str) -> String {
    format!("strftime('%Y-%m-%dT%H:%M:%SZ', {column})")
}

/// Abre (ou cria) o banco em `path`, aplica PRAGMAs e migrations.
pub fn open(path: &Path) -> AppResult<Connection> {
    let mut conn = Connection::open(path)?;
    apply_pragmas(&conn, true)?;
    migrate(&mut conn)?;
    Ok(conn)
}

/// Banco em memória com schema e seed (para testes).
pub fn open_in_memory() -> AppResult<Connection> {
    let mut conn = Connection::open_in_memory()?;
    apply_pragmas(&conn, false)?;
    migrate(&mut conn)?;
    Ok(conn)
}

// ---------------------------------------------------------------------------
// Utilitários internos
// ---------------------------------------------------------------------------

/// Formata a data como `YYYY-MM-DD`.
pub fn fmt_date(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

/// Literal SQL de data. Seguro: gerado a partir de `NaiveDate`, nunca de texto livre.
pub(crate) fn date_lit(date: NaiveDate) -> String {
    format!("'{}'", fmt_date(date))
}

/// Interpreta `YYYY-MM-DD` ou devolve `VALIDATION` no campo informado.
pub(crate) fn parse_date(field: &str, value: &str) -> AppResult<NaiveDate> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d")
        .map_err(|_| AppError::validation(field, "Data inválida; use o formato AAAA-MM-DD."))
}

/// Resolve paginação: `(page >= 1, page_size 1..=200, offset)`.
pub(crate) fn paging(page: Option<i64>, page_size: Option<i64>) -> (i64, i64, i64) {
    let page = page.unwrap_or(1).max(1);
    let size = page_size.unwrap_or(20).clamp(1, 200);
    (page, size, (page - 1) * size)
}

/// Texto obrigatório: faz trim e rejeita vazio com `VALIDATION` no campo.
pub(crate) fn require(field: &str, label: &str, value: &str) -> AppResult<String> {
    let v = value.trim();
    if v.is_empty() {
        Err(AppError::validation(field, format!("Informe {label}.")))
    } else {
        Ok(v.to_string())
    }
}

/// Texto opcional: trim, vazio vira `None`.
pub(crate) fn clean_opt(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|v| !v.is_empty())
        .map(str::to_string)
}

/// Converte violações de UNIQUE do SQLite em erros de domínio (rede de
/// segurança: os repositórios já checam antes de gravar).
pub(crate) fn map_write_err(err: rusqlite::Error) -> AppError {
    if let rusqlite::Error::SqliteFailure(_, Some(msg)) = &err {
        if msg.contains("books.title_norm") {
            return AppError::duplicate_title("Já existe um livro com esse título.");
        }
        // O SQLite não informa qual posição da lista causou a violação, então este
        // fallback sai com `field: "codes"` (sem índice). O índice `codes.<i>` é
        // produzido pelas checagens prévias de `books` (que cobrem o caso normal).
        if msg.contains("copies.registration_code") {
            return AppError::duplicate_code("Código de registro já cadastrado.");
        }
        if msg.contains("students.registration") {
            return AppError::duplicate_registration("Matrícula já cadastrada.");
        }
        if msg.contains("loans.copy_id") {
            return AppError::copy_unavailable("Este exemplar já está emprestado.");
        }
        if msg.contains("classes.name_norm") {
            return AppError::validation("name", "Já existe uma turma com esse nome neste ano.");
        }
        if msg.contains("categories.name_norm") {
            return AppError::validation("name", "Já existe uma categoria com esse nome.");
        }
    }
    err.into()
}

/// Construtor de cláusulas `WHERE` com parâmetros posicionais.
#[derive(Default)]
pub(crate) struct Filter {
    clauses: Vec<String>,
    params: Vec<Value>,
}

impl Filter {
    pub(crate) fn new() -> Self {
        Self::default()
    }

    /// Adiciona uma cláusula (com `?` para cada valor de `values`).
    pub(crate) fn push(&mut self, clause: impl Into<String>, values: Vec<Value>) {
        self.clauses.push(clause.into());
        self.params.extend(values);
    }

    /// `""` ou `" WHERE a AND b"`.
    pub(crate) fn where_sql(&self) -> String {
        if self.clauses.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", self.clauses.join(" AND "))
        }
    }

    /// Parâmetros do filtro seguidos de `extra`.
    pub(crate) fn params_with(&self, extra: Vec<Value>) -> Vec<Value> {
        let mut all = self.params.clone();
        all.extend(extra);
        all
    }
}

pub(crate) fn text(value: &str) -> Value {
    Value::Text(value.to_string())
}

#[cfg(test)]
pub(crate) mod testutil {
    use super::*;
    use crate::db::books::{self, BookInput};
    use crate::db::classes::{self, ClassInput};
    use crate::db::students::{self, StudentInput};
    use crate::db::teachers::{self, TeacherInput};
    use crate::db::types::Shift;

    pub fn today() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 10, 12).unwrap()
    }

    pub fn db() -> Connection {
        open_in_memory().unwrap()
    }

    /// Id da categoria "Romance" (seed).
    pub fn category_id(conn: &Connection, name: &str) -> i64 {
        conn.query_row(
            "SELECT id FROM categories WHERE name_norm = ?1",
            [crate::db::normalize::normalize(name)],
            |r| r.get(0),
        )
        .unwrap()
    }

    pub fn book(conn: &Connection, title: &str, codes: &[&str]) -> crate::db::books::Book {
        books::create(
            conn,
            &BookInput {
                title: title.into(),
                author: "Autor Teste".into(),
                subject: "Assunto".into(),
                category_id: category_id(conn, "Romance"),
                codes: codes.iter().map(|c| c.to_string()).collect(),
            },
        )
        .unwrap()
    }

    pub fn teacher(conn: &Connection, name: &str) -> i64 {
        teachers::create(
            conn,
            &TeacherInput {
                name: name.into(),
                contact: None,
            },
            today(),
        )
        .unwrap()
        .id
    }

    pub fn class(conn: &Connection, name: &str, teacher_id: i64) -> i64 {
        classes::create(
            conn,
            &ClassInput {
                name: name.into(),
                school_year: 2026,
                shift: Shift::Morning,
                teacher_id,
            },
            today(),
        )
        .unwrap()
        .id
    }

    pub fn student(conn: &Connection, name: &str, reg: &str, class_id: i64) -> i64 {
        students::create(
            conn,
            &StudentInput {
                name: name.into(),
                registration: reg.into(),
                class_id: Some(class_id),
                guardian: None,
                contact: None,
                notes: None,
            },
            today(),
        )
        .unwrap()
        .id
    }

    /// Cria no `conn` um banco na versão 3 do schema, com dados reais:
    /// 2 alunos na turma "5A", empréstimo ativo e devolvido, 1 leitura com 2 presenças.
    pub fn seed_v3(conn: &mut Connection) {
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        Migrations::new(vec![
            M::up(include_str!("../../migrations/0001_init.sql")),
            M::up(include_str!("../../migrations/0002_loan_book_id.sql")),
            M::up(include_str!("../../migrations/0003_class_readings.sql")),
        ])
        .to_latest(conn)
        .unwrap();
        conn.execute_batch(
            "INSERT INTO books (title, title_norm, author, author_norm, subject, subject_norm, category_id)
               VALUES ('T', 't', 'A', 'a', 'S', 's', 1);
             INSERT INTO copies (book_id, registration_code) VALUES (1, 'C1'), (1, 'C2');
             INSERT INTO teachers (name, name_norm) VALUES ('P', 'p');
             INSERT INTO classes (name, name_norm, school_year, shift, teacher_id)
               VALUES ('5A', '5a', 2026, 'morning', 1);
             INSERT INTO students (name, name_norm, registration, class_id)
               VALUES ('Ana', 'ana', 'M1', 1), ('Bia', 'bia', 'M2', 1);
             INSERT INTO loans (copy_id, student_id, book_id, copy_code, book_title, book_author, book_norm,
                                loaned_at, due_at, returned_at, marked_read)
               VALUES (1, 1, 1, 'C1', 'T', 'A', 't a', '2026-10-01', '2026-10-10', '2026-10-05', 1),
                      (2, 1, 1, 'C2', 'T', 'A', 't a', '2026-10-06', '2026-10-30', NULL, 0);
             INSERT INTO class_readings (class_id, book_id, book_title, book_author, book_norm, read_at)
               VALUES (1, 1, 'T', 'A', 't a', '2026-10-08');
             INSERT INTO class_reading_students (reading_id, student_id) VALUES (1, 1), (1, 2);",
        )
        .unwrap();
    }

    /// Cria professor + turma + aluno e devolve `(teacher_id, class_id, student_id)`.
    pub fn school(conn: &Connection) -> (i64, i64, i64) {
        let t = teacher(conn, "Profa. Marta");
        let c = class(conn, "5º ano A", t);
        let s = student(conn, "João da Silva", "2026001", c);
        (t, c, s)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn abre_aplica_schema_e_seed() {
        let conn = open_in_memory().unwrap();
        let version: i32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        let cats: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))
            .unwrap();
        assert_eq!(cats, 7);
        let fk: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        assert_eq!(fk, 1);
    }

    #[test]
    fn migration_0002_preenche_book_id_dos_emprestimos_existentes() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        // schema v1 com dados
        Migrations::new(vec![M::up(include_str!("../../migrations/0001_init.sql"))])
            .to_latest(&mut conn)
            .unwrap();
        conn.execute_batch(
            "INSERT INTO books (title, title_norm, author, author_norm, subject, subject_norm, category_id)
               VALUES ('T', 't', 'A', 'a', 'S', 's', 1);
             INSERT INTO copies (book_id, registration_code) VALUES (1, 'C1');
             INSERT INTO teachers (name, name_norm) VALUES ('P', 'p');
             INSERT INTO loans (copy_id, teacher_id, copy_code, book_title, book_author, book_norm, loaned_at, due_at)
               VALUES (1, 1, 'C1', 'T', 'A', 't a', '2026-10-01', '2026-10-10'),
                      (NULL, 1, 'C0', 'Apagado', 'A', 'apagado a', '2026-09-01', '2026-09-10');",
        )
        .unwrap();

        migrate(&mut conn).unwrap();
        let ids: Vec<Option<i64>> = conn
            .prepare("SELECT book_id FROM loans ORDER BY id")
            .unwrap()
            .query_map([], |r| r.get(0))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        assert_eq!(ids, vec![Some(1), None]);
        let violations: i64 = conn
            .query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| {
                r.get(0)
            })
            .unwrap();
        assert_eq!(violations, 0);
        // os empréstimos sobreviveram à migração (sem DELETE em cascata)
        let loans: i64 = conn
            .query_row("SELECT COUNT(*) FROM loans", [], |r| r.get(0))
            .unwrap();
        assert_eq!(loans, 2);
        // excluir o livro zera book_id (SET NULL) mas mantém o empréstimo
        conn.execute("DELETE FROM books WHERE id = 1", []).unwrap();
        let nulls: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM loans WHERE book_id IS NULL",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(nulls, 2);
    }

    #[test]
    fn migration_0003_atualiza_banco_v2_sem_perder_dados() {
        let mut conn = Connection::open_in_memory().unwrap();
        conn.pragma_update(None, "foreign_keys", "ON").unwrap();
        Migrations::new(vec![
            M::up(include_str!("../../migrations/0001_init.sql")),
            M::up(include_str!("../../migrations/0002_loan_book_id.sql")),
        ])
        .to_latest(&mut conn)
        .unwrap();
        conn.execute_batch(
            "INSERT INTO books (title, title_norm, author, author_norm, subject, subject_norm, category_id)
               VALUES ('T', 't', 'A', 'a', 'S', 's', 1);
             INSERT INTO copies (book_id, registration_code) VALUES (1, 'C1');
             INSERT INTO teachers (name, name_norm) VALUES ('P', 'p');
             INSERT INTO classes (name, name_norm, school_year, shift, teacher_id)
               VALUES ('5A', '5a', 2026, 'morning', 1);
             INSERT INTO students (name, name_norm, registration, class_id)
               VALUES ('Ana', 'ana', 'M1', 1);
             INSERT INTO loans (copy_id, student_id, book_id, copy_code, book_title, book_author, book_norm,
                                loaned_at, due_at, returned_at, marked_read)
               VALUES (1, 1, 1, 'C1', 'T', 'A', 't a', '2026-10-01', '2026-10-10', '2026-10-05', 1);",
        )
        .unwrap();
        let v: i32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, 2);

        migrate(&mut conn).unwrap();
        let v: i32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, SCHEMA_VERSION);
        for table in ["students", "loans", "books", "classes"] {
            let n: i64 = conn
                .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
                .unwrap();
            assert_eq!(n, 1, "{table} preservada");
        }
        let n: i64 = conn
            .query_row("SELECT COUNT(*) FROM class_readings", [], |r| r.get(0))
            .unwrap();
        assert_eq!(n, 0);
        // o livro lido pelo empréstimo antigo continua contando
        assert_eq!(
            crate::db::students::get(&conn, 1, testutil::today())
                .unwrap()
                .read_count,
            1
        );
    }

    fn count(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
            .unwrap()
    }

    #[test]
    fn migration_0004_v3_para_v4_preserva_emprestimos_e_presencas() {
        let mut conn = Connection::open_in_memory().unwrap();
        testutil::seed_v3(&mut conn);
        assert_eq!(count(&conn, "loans"), 2);
        assert_eq!(count(&conn, "class_reading_students"), 2);

        migrate(&mut conn).unwrap();

        let v: i32 = conn
            .query_row("PRAGMA user_version", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, 4);
        assert_eq!(count(&conn, "loans"), 2, "sem cascata em loans");
        assert_eq!(
            count(&conn, "class_reading_students"),
            2,
            "sem cascata nas presenças"
        );
        assert_eq!(count(&conn, "students"), 2);
        assert_eq!(count(&conn, "class_readings"), 1);
        assert_eq!(count(&conn, "pragma_foreign_key_check"), 0);
        let fk: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        assert_eq!(fk, 1);
        let name: String = conn
            .query_row(
                "SELECT class_name FROM class_readings WHERE id = 1",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(name, "5A");

        // índices recriados
        for idx in [
            "idx_students_class",
            "idx_class_readings_unique",
            "idx_class_readings_book",
            "idx_crs_student",
            "idx_loans_student",
        ] {
            let n: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = ?1",
                    [idx],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(n, 1, "{idx}");
        }

        // FKs funcionam no schema novo: excluir a turma solta alunos, mantém o resto
        let s = crate::db::students::get(&conn, 1, testutil::today()).unwrap();
        assert_eq!((s.active_loans, s.read_count), (1, 1));
        crate::db::classes::delete(&conn, 1).unwrap();
        assert_eq!(count(&conn, "students"), 2);
        assert_eq!(count(&conn, "loans"), 2);
        assert_eq!(count(&conn, "class_reading_students"), 2);
        // excluir aluno ainda cascateia no próprio histórico
        conn.execute("DELETE FROM loans WHERE returned_at IS NULL", [])
            .unwrap();
        crate::db::students::delete(&conn, 1).unwrap();
        assert_eq!(count(&conn, "loans"), 0);
        assert_eq!(count(&conn, "class_reading_students"), 1);
    }

    #[test]
    fn libok_norm_esta_disponivel_no_sql() {
        let conn = open_in_memory().unwrap();
        let v: String = conn
            .query_row("SELECT libok_norm('  ÁB-01 ')", [], |r| r.get(0))
            .unwrap();
        assert_eq!(v, "ab-01");
    }

    #[test]
    fn seed_tem_names_norm_consistentes() {
        let conn = open_in_memory().unwrap();
        let mut stmt = conn
            .prepare("SELECT name, name_norm FROM categories")
            .unwrap();
        let rows: Vec<(String, String)> = stmt
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();
        for (name, norm) in rows {
            assert_eq!(normalize::normalize(&name), norm);
        }
    }

    #[test]
    fn open_em_arquivo_e_reabre() {
        let dir = std::env::temp_dir().join(format!("libok-test-open-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("libok.db");
        drop(open(&path).unwrap());
        let conn = open(&path).unwrap();
        let cats: i64 = conn
            .query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))
            .unwrap();
        assert_eq!(cats, 7);
        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
