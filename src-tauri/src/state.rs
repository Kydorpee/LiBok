//! Estado global gerenciado pelo Tauri (`State<DbState>` nos commands).

use crate::error::AppResult;
use rusqlite::Connection;
use std::sync::{Arc, Mutex, MutexGuard};

/// Conexão única com o SQLite, protegida por `Mutex`.
///
/// O `Arc` permite clonar o handle (barato) para levar a conexão a uma thread
/// de bloqueio (`spawn_blocking`) nos commands de arquivo, que precisam de um
/// valor `'static`; continua existindo uma única conexão.
#[derive(Clone)]
pub struct DbState(Arc<Mutex<Connection>>);

impl DbState {
    pub fn new(conn: Connection) -> Self {
        Self(Arc::new(Mutex::new(conn)))
    }

    /// Obtém a conexão; lock envenenado vira `AppError` com código `DB`.
    pub fn conn(&self) -> AppResult<MutexGuard<'_, Connection>> {
        Ok(self.0.lock()?)
    }
}
