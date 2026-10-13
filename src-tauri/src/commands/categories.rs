//! Commands de categorias: `list_categories`, `create_category`, `update_category`.

use crate::db::categories::{self, Category};
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn list_categories(state: State<'_, DbState>) -> AppResult<Vec<Category>> {
    categories::list(&*state.conn()?)
}

#[tauri::command]
pub async fn create_category(
    state: State<'_, DbState>,
    name: String,
    color: Option<String>,
) -> AppResult<Category> {
    categories::create(&*state.conn()?, &name, color.as_deref())
}

#[tauri::command]
pub async fn update_category(
    state: State<'_, DbState>,
    id: i64,
    name: String,
    color: String,
) -> AppResult<Category> {
    categories::update(&*state.conn()?, id, &name, &color)
}
