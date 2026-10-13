//! Command do dashboard: `get_stats`.

use super::today;
use crate::db::stats::{self, Stats};
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn get_stats(state: State<'_, DbState>) -> AppResult<Stats> {
    stats::get(&*state.conn()?, today())
}
