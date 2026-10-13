//! Commands de professores: `list_teachers`, `create_teacher`, `update_teacher`, `delete_teacher`.

use super::today;
use crate::db::teachers::{self, Teacher, TeacherInput};
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn list_teachers(
    state: State<'_, DbState>,
    text: Option<String>,
) -> AppResult<Vec<Teacher>> {
    teachers::list(&*state.conn()?, text.as_deref(), today())
}

#[tauri::command]
pub async fn create_teacher(state: State<'_, DbState>, input: TeacherInput) -> AppResult<Teacher> {
    teachers::create(&*state.conn()?, &input, today())
}

#[tauri::command]
pub async fn update_teacher(
    state: State<'_, DbState>,
    id: i64,
    input: TeacherInput,
) -> AppResult<Teacher> {
    teachers::update(&*state.conn()?, id, &input, today())
}

#[tauri::command]
pub async fn delete_teacher(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    teachers::delete(&*state.conn()?, id)
}
