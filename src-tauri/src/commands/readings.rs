//! Commands de leituras coletivas da turma: `list_class_readings`,
//! `create_class_reading`, `delete_class_reading`.

use crate::db::readings;
use crate::db::types::{ClassReading, ClassReadingInput};
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn list_class_readings(
    state: State<'_, DbState>,
    class_id: i64,
) -> AppResult<Vec<ClassReading>> {
    readings::list_for_class(&*state.conn()?, class_id)
}

#[tauri::command]
pub async fn create_class_reading(
    state: State<'_, DbState>,
    input: ClassReadingInput,
) -> AppResult<ClassReading> {
    readings::create(&*state.conn()?, &input)
}

#[tauri::command]
pub async fn delete_class_reading(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    readings::delete(&*state.conn()?, id)
}
