//! Backup online e restauração segura do arquivo `.db`.

use super::{SCHEMA_VERSION, apply_pragmas, migrate};
use crate::error::{AppError, AppResult};
use rusqlite::backup::Progress;
use rusqlite::{Connection, OpenFlags};
use std::path::{Path, PathBuf};

/// Copia o banco aberto para `path` (backup online consistente, mesmo com o app em uso).
/// O arquivo gerado é autocontido (sem `-wal`).
///
/// Recusa (`VALIDATION`) o próprio arquivo do banco em uso. A cópia vai para um
/// arquivo temporário vizinho e só substitui o destino no final, então um backup
/// anterior nunca é perdido se a cópia falhar.
pub fn backup(conn: &Connection, path: &Path) -> AppResult<()> {
    ensure_not_live(conn, path)?;
    let mut tmp_name = path.as_os_str().to_owned();
    tmp_name.push(".tmp");
    let tmp = std::path::PathBuf::from(tmp_name);
    let _ = std::fs::remove_file(&tmp);
    let result = copy_to(conn, &tmp).and_then(|()| Ok(std::fs::rename(&tmp, path)?));
    if result.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    result
}

/// Caminho canônico, mesmo quando o arquivo ainda não existe (canoniza o diretório).
fn canonical(path: &Path) -> Option<std::path::PathBuf> {
    if let Ok(p) = path.canonicalize() {
        return Some(p);
    }
    let parent = path.parent().filter(|p| !p.as_os_str().is_empty());
    let dir = parent.unwrap_or_else(|| Path::new("."));
    Some(dir.canonicalize().ok()?.join(path.file_name()?))
}

/// `true` se `path` aponta para o arquivo do banco aberto em `conn` ou para seus
/// arquivos auxiliares (`-wal`, `-shm`, `-journal`).
pub(crate) fn is_live_db(conn: &Connection, path: &Path) -> bool {
    let Some(db_path) = conn.path().filter(|p| !p.is_empty()) else {
        return false;
    };
    let Some(target) = canonical(path) else {
        return false;
    };
    let same = |a: &Path, b: &Path| {
        if cfg!(windows) {
            a.to_string_lossy().to_lowercase() == b.to_string_lossy().to_lowercase()
        } else {
            a == b
        }
    };
    ["", "-wal", "-shm", "-journal"].iter().any(|suffix| {
        let mut name = std::ffi::OsString::from(db_path);
        name.push(suffix);
        canonical(Path::new(&name)).is_some_and(|c| same(c.as_path(), target.as_path()))
    })
}

/// Recusa (`VALIDATION`, `field: "path"`) o arquivo do banco em uso.
pub(crate) fn ensure_not_live(conn: &Connection, path: &Path) -> AppResult<()> {
    if is_live_db(conn, path) {
        return Err(AppError::validation(
            "path",
            "Escolha um arquivo diferente do banco de dados em uso.",
        ));
    }
    Ok(())
}

fn copy_to(conn: &Connection, path: &Path) -> AppResult<()> {
    conn.backup("main", path, None)?;
    let out = Connection::open(path)?;
    out.pragma_update(None, "journal_mode", "DELETE")?;
    Ok(())
}

/// Valida que `path` é um banco do LiBok íntegro e compatível.
fn validate(path: &Path) -> AppResult<()> {
    if !path.is_file() {
        return Err(AppError::io("Arquivo de backup não encontrado."));
    }
    let invalid = || {
        AppError::validation(
            "path",
            "O arquivo selecionado não é um backup válido do LiBok.",
        )
    };
    let src = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)
        .map_err(|_| invalid())?;
    let integrity: String = src
        .query_row("PRAGMA integrity_check", [], |r| r.get(0))
        .map_err(|_| invalid())?;
    if integrity != "ok" {
        return Err(invalid());
    }
    let tables: i64 = src
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table'
             AND name IN ('categories', 'books', 'copies')",
            [],
            |r| r.get(0),
        )
        .map_err(|_| invalid())?;
    if tables != 3 {
        return Err(invalid());
    }
    let version: i32 = src.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version > SCHEMA_VERSION {
        return Err(AppError::validation(
            "path",
            "Este backup foi gerado por uma versão mais nova do LiBok.",
        ));
    }
    Ok(())
}

fn journal_is_wal(conn: &Connection) -> bool {
    conn.query_row("PRAGMA journal_mode", [], |r| r.get::<_, String>(0))
        .is_ok_and(|m| m.eq_ignore_ascii_case("wal"))
}

/// Substitui o conteúdo do banco aberto pelo do backup em `path`.
/// Veja [`restore_with_safety_copy`]; esta versão descarta o caminho da cópia.
pub fn restore(conn: &mut Connection, path: &Path) -> AppResult<()> {
    restore_with_safety_copy(conn, path).map(|_| ())
}

/// Substitui o conteúdo do banco aberto pelo do backup em `path` e devolve o
/// caminho da cópia de segurança do banco anterior
/// (`<pasta do banco>/backups/libok-pre-restore-AAAAMMDD-HHMMSS.db`), ou `None`
/// quando o banco é em memória (sem arquivo).
///
/// O arquivo é validado antes (integridade, tabelas e versão) e o banco em uso é
/// recusado como origem. A cópia é atômica (uma transação do SQLite); depois dela
/// as migrations e PRAGMAs são reaplicados (para aceitar backups de versões
/// anteriores do schema). Se a migração falhar, a cópia de segurança é restaurada.
pub fn restore_with_safety_copy(conn: &mut Connection, path: &Path) -> AppResult<Option<PathBuf>> {
    ensure_not_live(conn, path)?;
    validate(path)?;
    let safety = pre_restore_copy(conn)?;
    let wal = journal_is_wal(conn);
    conn.restore("main", path, None::<fn(Progress)>)?;
    if let Err(err) = migrate(conn) {
        if let Some(copy) = &safety {
            // Tenta voltar ao estado anterior; o erro original é o que importa.
            let _ = conn.restore("main", copy, None::<fn(Progress)>);
            let _ = apply_pragmas(conn, wal);
        }
        return Err(err);
    }
    apply_pragmas(conn, wal)?;
    Ok(safety)
}

/// Copia o banco atual para `backups/libok-pre-restore-<data-hora>.db` ao lado do arquivo vivo.
fn pre_restore_copy(conn: &Connection) -> AppResult<Option<PathBuf>> {
    let Some(db_path) = conn.path().filter(|p| !p.is_empty()) else {
        return Ok(None);
    };
    let dir = Path::new(db_path)
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or_else(|| Path::new("."))
        .join("backups");
    std::fs::create_dir_all(&dir)?;
    let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S");
    let mut target = dir.join(format!("libok-pre-restore-{stamp}.db"));
    let mut n = 1;
    while target.exists() {
        target = dir.join(format!("libok-pre-restore-{stamp}-{n}.db"));
        n += 1;
    }
    copy_to(conn, &target)?;
    Ok(Some(target))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::books::{self, BookQuery};
    use crate::db::testutil::{book, db};
    use crate::error::ErrorCode;
    use std::path::PathBuf;

    fn dir(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("libok-bk-{}-{name}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn backup_e_restauracao() {
        let d = dir("ok");
        let file = d.join("copia.db");
        let mut conn = db();
        book(&conn, "Livro Salvo", &["A1"]);
        backup(&conn, &file).unwrap();
        assert!(file.is_file());

        book(&conn, "Livro Depois", &["A2"]);
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 2);

        restore(&mut conn, &file).unwrap();
        let after = books::list(&conn, &BookQuery::default()).unwrap();
        assert_eq!(after.total, 1);
        assert_eq!(after.items[0].title, "Livro Salvo");
        // a conexão continua utilizável, com FKs ligadas
        let fk: i64 = conn
            .query_row("PRAGMA foreign_keys", [], |r| r.get(0))
            .unwrap();
        assert_eq!(fk, 1);
        book(&conn, "Novo", &["Z9"]);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn restore_rejeita_arquivo_invalido_sem_tocar_no_banco() {
        let d = dir("bad");
        let mut conn = db();
        book(&conn, "Intacto", &["A1"]);

        let garbage = d.join("lixo.db");
        std::fs::write(&garbage, b"isto nao e um banco sqlite, de jeito nenhum").unwrap();
        assert_eq!(
            restore(&mut conn, &garbage).unwrap_err().code,
            ErrorCode::Validation
        );

        // banco SQLite válido, mas que não é do LiBok
        let other = d.join("outro.db");
        {
            let c = Connection::open(&other).unwrap();
            c.execute_batch("CREATE TABLE x (id INTEGER);").unwrap();
        }
        assert_eq!(
            restore(&mut conn, &other).unwrap_err().code,
            ErrorCode::Validation
        );

        assert_eq!(
            restore(&mut conn, &d.join("nao-existe.db"))
                .unwrap_err()
                .code,
            ErrorCode::Io
        );
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 1);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn backup_recusa_o_proprio_banco_em_uso() {
        let d = dir("live");
        let live = d.join("libok.db");
        let conn = crate::db::open(&live).unwrap();
        book(&conn, "Livro", &["A1"]);
        let err = backup(&conn, &live).unwrap_err();
        assert_eq!(err.code, ErrorCode::Validation);
        // caminho equivalente (com ".") também é recusado
        let alias = d.join(".").join("libok.db");
        assert_eq!(
            backup(&conn, &alias).unwrap_err().code,
            ErrorCode::Validation
        );
        // o banco continua intacto e um destino diferente funciona
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 1);
        let other = d.join("copia.db");
        backup(&conn, &other).unwrap();
        // sobrescrever um backup existente funciona e não deixa .tmp
        backup(&conn, &other).unwrap();
        assert!(!d.join("copia.db.tmp").exists());
        drop(conn);
        let _ = std::fs::remove_dir_all(&d);
    }

    fn pragma(conn: &Connection, name: &str) -> String {
        conn.query_row(&format!("PRAGMA {name}"), [], |r| {
            r.get::<_, rusqlite::types::Value>(0).map(|v| match v {
                rusqlite::types::Value::Integer(i) => i.to_string(),
                rusqlite::types::Value::Text(t) => t,
                other => format!("{other:?}"),
            })
        })
        .unwrap()
    }

    #[test]
    fn backup_mutacao_restore_com_arquivo_em_wal() {
        let d = dir("wal");
        let live = d.join("libok.db");
        let mut conn = crate::db::open(&live).unwrap();
        assert_eq!(pragma(&conn, "journal_mode"), "wal");
        book(&conn, "Livro Salvo", &["A1"]);

        let file = d.join("copia.db");
        backup(&conn, &file).unwrap();
        assert!(
            !d.join("copia.db-wal").exists(),
            "o backup é autocontido (sem -wal)"
        );

        book(&conn, "Livro Depois", &["A2"]);
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 2);

        let safety = restore_with_safety_copy(&mut conn, &file)
            .unwrap()
            .expect("cópia de segurança");
        // estado restaurado
        let after = books::list(&conn, &BookQuery::default()).unwrap();
        assert_eq!(after.total, 1);
        assert_eq!(after.items[0].title, "Livro Salvo");
        // PRAGMAs preservados na mesma conexão
        assert_eq!(pragma(&conn, "journal_mode"), "wal");
        assert_eq!(pragma(&conn, "foreign_keys"), "1");
        assert_eq!(pragma(&conn, "user_version"), SCHEMA_VERSION.to_string());
        // a conexão continua gravável
        book(&conn, "Novo", &["Z9"]);

        // cópia de segurança: em backups/, nome com data-hora, com o estado anterior
        assert_eq!(safety.parent().unwrap(), d.join("backups"));
        let name = safety.file_name().unwrap().to_string_lossy().into_owned();
        assert!(
            name.starts_with("libok-pre-restore-") && name.ends_with(".db"),
            "{name}"
        );
        let old = Connection::open(&safety).unwrap();
        let titles: i64 = old
            .query_row("SELECT COUNT(*) FROM books", [], |r| r.get(0))
            .unwrap();
        assert_eq!(titles, 2);

        // restore sem alterar nada também gera outra cópia, sem sobrescrever a anterior
        let second = restore_with_safety_copy(&mut conn, &file).unwrap().unwrap();
        assert_ne!(second, safety);
        drop((conn, old));
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn restore_e_backup_recusam_o_banco_em_uso_e_auxiliares() {
        let d = dir("live-restore");
        let live = d.join("libok.db");
        let mut conn = crate::db::open(&live).unwrap();
        book(&conn, "Intacto", &["A1"]);
        for name in ["libok.db", "libok.db-wal", "libok.db-shm"] {
            let target = d.join(name);
            let err = restore(&mut conn, &target).unwrap_err();
            assert_eq!(err.code, ErrorCode::Validation, "restore {name}");
            assert_eq!(err.field.as_deref(), Some("path"));
            let err = backup(&conn, &target).unwrap_err();
            assert_eq!(err.code, ErrorCode::Validation, "backup {name}");
            assert_eq!(err.field.as_deref(), Some("path"));
        }
        assert!(
            !d.join("backups").exists(),
            "recusado antes de copiar qualquer coisa"
        );
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 1);
        drop(conn);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn migracao_que_falha_apos_o_restore_volta_a_copia_de_seguranca() {
        let d = dir("migfail");
        let live = d.join("libok.db");
        let mut conn = crate::db::open(&live).unwrap();
        book(&conn, "Intacto", &["A1"]);

        // passa na validação (3 tabelas, versão 1), mas não tem `loans`: a 0002 falha
        let bad = d.join("quebrado.db");
        {
            let c = Connection::open(&bad).unwrap();
            c.execute_batch(
                "CREATE TABLE categories (id INTEGER PRIMARY KEY, name TEXT);
                 CREATE TABLE books (id INTEGER PRIMARY KEY);
                 CREATE TABLE copies (id INTEGER PRIMARY KEY);
                 PRAGMA user_version = 1;",
            )
            .unwrap();
        }
        assert!(restore(&mut conn, &bad).is_err());

        let after = books::list(&conn, &BookQuery::default()).unwrap();
        assert_eq!(after.total, 1);
        assert_eq!(after.items[0].title, "Intacto");
        assert_eq!(pragma(&conn, "user_version"), SCHEMA_VERSION.to_string());
        assert_eq!(pragma(&conn, "foreign_keys"), "1");
        assert_eq!(pragma(&conn, "journal_mode"), "wal");
        book(&conn, "Continua gravando", &["B1"]);
        drop(conn);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn restaura_backup_de_schema_anterior_e_migra() {
        let d = dir("v1");
        let v1 = d.join("v1.db");
        {
            let c = Connection::open(&v1).unwrap();
            c.execute_batch(include_str!("../../migrations/0001_init.sql"))
                .unwrap();
            c.pragma_update(None, "user_version", 1).unwrap();
            c.execute_batch(
                "INSERT INTO books (title, title_norm, author, author_norm, subject, subject_norm, category_id)
                   VALUES ('Antigo', 'antigo', 'A', 'a', 'S', 's', 1);
                 INSERT INTO copies (book_id, registration_code) VALUES (1, 'V1');",
            )
            .unwrap();
        }
        let live = d.join("libok.db");
        let mut conn = crate::db::open(&live).unwrap();
        restore(&mut conn, &v1).unwrap();
        assert_eq!(pragma(&conn, "user_version"), SCHEMA_VERSION.to_string());
        conn.prepare("SELECT book_id FROM loans").unwrap(); // coluna da 0002 existe
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 1);
        drop(conn);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn restore_rejeita_versao_mais_nova() {
        let d = dir("newer");
        let file = d.join("futuro.db");
        let conn = db();
        backup(&conn, &file).unwrap();
        {
            let c = Connection::open(&file).unwrap();
            c.pragma_update(None, "user_version", SCHEMA_VERSION + 1)
                .unwrap();
        }
        let mut target = db();
        assert_eq!(
            restore(&mut target, &file).unwrap_err().code,
            ErrorCode::Validation
        );
        let _ = std::fs::remove_dir_all(&d);
    }
}
