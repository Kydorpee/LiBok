//! Commands de arquivos: `export_csv`, `preview_csv`, `import_csv`, `backup_db`, `restore_db`,
//! e da importação revisada no front: `validate_import_rows`, `import_rows`.
//!
//! O caminho vem do diálogo nativo aberto pelo front (`tauri-plugin-dialog`),
//! mas é tratado como entrada não confiável (F-08):
//! * a extensão é validada aqui, antes de tocar no banco ou no disco
//!   (`.csv` para CSV, `.db` para backup, sem diferenciar maiúsculas);
//! * o arquivo do banco em uso (e `-wal`/`-shm`/`-journal`) é recusado pelo
//!   repositório (`db::backup::ensure_not_live`) em `export_csv`, `backup_db`
//!   e `restore_db`; `preview_csv` e `import_csv` só leem o arquivo.
//!
//! O trabalho (I/O de arquivo + SQLite) roda em `spawn_blocking` (F-17), para
//! não ocupar um worker do runtime assíncrono durante importações grandes.

use crate::db::backup;
use crate::db::csv::{self, CsvPreview, ImportReport, ImportRow};
use crate::error::{AppError, AppResult};
use crate::state::DbState;
use rusqlite::Connection;
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::State;

/// Saída de `export_csv`: `{ rows }`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub rows: usize,
}

/// Recusa (`VALIDATION`, `field: "path"`) caminhos sem a extensão esperada.
fn require_extension(path: &Path, ext: &str, message: &str) -> AppResult<()> {
    let ok = path
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case(ext));
    if ok {
        Ok(())
    } else {
        Err(AppError::validation("path", message))
    }
}

fn require_csv(path: &Path) -> AppResult<()> {
    require_extension(path, "csv", "Escolha um arquivo com extensão .csv.")
}

fn require_db(path: &Path) -> AppResult<()> {
    require_extension(path, "db", "Escolha um arquivo de backup com extensão .db.")
}

/// Roda `f` com a conexão travada numa thread de bloqueio do runtime.
async fn with_conn_blocking<T, F>(state: &DbState, f: F) -> AppResult<T>
where
    T: Send + 'static,
    F: FnOnce(&mut Connection) -> AppResult<T> + Send + 'static,
{
    let db = state.clone();
    tauri::async_runtime::spawn_blocking(move || -> AppResult<T> {
        let mut conn = db.conn()?;
        f(&mut conn)
    })
    .await?
}

#[tauri::command]
pub async fn export_csv(state: State<'_, DbState>, path: PathBuf) -> AppResult<ExportResult> {
    require_csv(&path)?;
    let rows = with_conn_blocking(&state, move |conn| csv::export(conn, &path)).await?;
    Ok(ExportResult { rows })
}

#[tauri::command]
pub async fn preview_csv(state: State<'_, DbState>, path: PathBuf) -> AppResult<CsvPreview> {
    require_csv(&path)?;
    with_conn_blocking(&state, move |conn| csv::preview(conn, &path)).await
}

#[tauri::command]
pub async fn import_csv(state: State<'_, DbState>, path: PathBuf) -> AppResult<ImportReport> {
    require_csv(&path)?;
    with_conn_blocking(&state, move |conn| csv::import(conn, &path)).await
}

/// Revalida as linhas (possivelmente corrigidas no front) com as mesmas regras
/// da prévia, inclusive duplicidade entre as próprias linhas. Não grava nada.
#[tauri::command]
pub async fn validate_import_rows(
    state: State<'_, DbState>,
    rows: Vec<ImportRow>,
) -> AppResult<CsvPreview> {
    with_conn_blocking(&state, move |conn| csv::validate_rows(conn, &rows)).await
}

/// Revalida e grava só as linhas `ready`; as demais vão para o relatório.
#[tauri::command]
pub async fn import_rows(
    state: State<'_, DbState>,
    rows: Vec<ImportRow>,
) -> AppResult<ImportReport> {
    with_conn_blocking(&state, move |conn| csv::import_rows(conn, &rows)).await
}

#[tauri::command]
pub async fn backup_db(state: State<'_, DbState>, path: PathBuf) -> AppResult<()> {
    require_db(&path)?;
    with_conn_blocking(&state, move |conn| backup::backup(conn, &path)).await
}

/// Restaura o backup. Antes, o banco atual é copiado para
/// `app_data_dir()/backups/libok-pre-restore-<data-hora>.db` (F-03); o caminho
/// da cópia vai para o log. O contrato continua `void`.
#[tauri::command]
pub async fn restore_db(state: State<'_, DbState>, path: PathBuf) -> AppResult<()> {
    require_db(&path)?;
    with_conn_blocking(&state, move |conn| {
        let result = backup::restore_with_safety_copy(conn, &path);
        match &result {
            Ok(Some(copy)) => log::info!(
                "restore_db: banco restaurado de {}; cópia de segurança do banco anterior em {}",
                path.display(),
                copy.display()
            ),
            Ok(None) => log::info!(
                "restore_db: banco em memória restaurado de {} (sem cópia de segurança)",
                path.display()
            ),
            Err(err) => log::warn!(
                "restore_db: falha ao restaurar de {}: {}",
                path.display(),
                err.message
            ),
        }
        result.map(|_| ())
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::ErrorCode;

    #[test]
    fn extensao_sem_diferenciar_maiusculas() {
        for ok in ["a.csv", "A.CSV", r"C:\pasta\Acervo.Csv", "x.y.csv"] {
            assert!(require_csv(Path::new(ok)).is_ok(), "{ok}");
        }
        for bad in ["a.txt", "a", ".csv", "a.csv.exe", "a.db", "acervo.csv-wal"] {
            let err = require_csv(Path::new(bad)).unwrap_err();
            assert_eq!(err.code, ErrorCode::Validation, "{bad}");
            assert_eq!(err.field.as_deref(), Some("path"));
        }
        for ok in ["b.db", "B.DB", "libok-backup.Db"] {
            assert!(require_db(Path::new(ok)).is_ok(), "{ok}");
        }
        for bad in ["b.csv", "b.db-wal", "b.db-shm", "b.sqlite", "b"] {
            assert!(require_db(Path::new(bad)).is_err(), "{bad}");
        }
    }
}
