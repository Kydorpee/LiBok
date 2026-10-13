//! Commands de turmas: `list_classes`, `get_class`, `create_class`, `update_class`, `delete_class`.

use super::today;
use crate::db::classes::{self, ClassDetail, ClassInput, ClassQuery, ClassRoom};
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn list_classes(
    state: State<'_, DbState>,
    query: ClassQuery,
) -> AppResult<Vec<ClassRoom>> {
    classes::list(&*state.conn()?, &query, today())
}

#[tauri::command]
pub async fn get_class(state: State<'_, DbState>, id: i64) -> AppResult<ClassDetail> {
    classes::get_detail(&*state.conn()?, id, today())
}

#[tauri::command]
pub async fn create_class(state: State<'_, DbState>, input: ClassInput) -> AppResult<ClassRoom> {
    classes::create(&*state.conn()?, &input, today())
}

#[tauri::command]
pub async fn update_class(
    state: State<'_, DbState>,
    id: i64,
    input: ClassInput,
) -> AppResult<ClassRoom> {
    classes::update(&*state.conn()?, id, &input, today())
}

#[tauri::command]
pub async fn delete_class(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    classes::delete(&*state.conn()?, id)
}
