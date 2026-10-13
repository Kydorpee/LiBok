//! Commands de alunos: `list_students`, `get_student`, `create_student`, `update_student`,
//! `delete_student`.

use super::today;
use crate::db::students::{self, Student, StudentInput, StudentQuery};
use crate::db::types::Page;
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn list_students(
    state: State<'_, DbState>,
    query: StudentQuery,
) -> AppResult<Page<Student>> {
    students::list(&*state.conn()?, &query, today())
}

#[tauri::command]
pub async fn get_student(state: State<'_, DbState>, id: i64) -> AppResult<Student> {
    students::get(&*state.conn()?, id, today())
}

#[tauri::command]
pub async fn create_student(state: State<'_, DbState>, input: StudentInput) -> AppResult<Student> {
    students::create(&*state.conn()?, &input, today())
}

#[tauri::command]
pub async fn update_student(
    state: State<'_, DbState>,
    id: i64,
    input: StudentInput,
) -> AppResult<Student> {
    students::update(&*state.conn()?, id, &input, today())
}

#[tauri::command]
pub async fn delete_student(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    students::delete(&*state.conn()?, id)
}
