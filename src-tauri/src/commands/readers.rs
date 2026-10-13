//! Commands de leitores: `search_readers`, `get_reader_summary`.

use super::today;
use crate::db::readers::{self, ReaderSummary};
use crate::db::types::{Reader, ReaderKind};
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn search_readers(
    state: State<'_, DbState>,
    text: String,
    limit: Option<i64>,
) -> AppResult<Vec<Reader>> {
    readers::search_readers(&*state.conn()?, &text, limit, today())
}

#[tauri::command]
pub async fn get_reader_summary(
    state: State<'_, DbState>,
    kind: ReaderKind,
    id: i64,
) -> AppResult<ReaderSummary> {
    readers::get_reader_summary(&*state.conn()?, kind, id, today())
}
