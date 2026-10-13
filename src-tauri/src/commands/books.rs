//! Commands de livros: `list_books`, `get_book`, `create_book`, `update_book`, `delete_book`.

use crate::db::books::{self, Book, BookInput, BookQuery};
use crate::db::types::Page;
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn list_books(state: State<'_, DbState>, query: BookQuery) -> AppResult<Page<Book>> {
    books::list(&*state.conn()?, &query)
}

#[tauri::command]
pub async fn get_book(state: State<'_, DbState>, id: i64) -> AppResult<Book> {
    books::get(&*state.conn()?, id)
}

#[tauri::command]
pub async fn create_book(state: State<'_, DbState>, input: BookInput) -> AppResult<Book> {
    books::create(&*state.conn()?, &input)
}

#[tauri::command]
pub async fn update_book(state: State<'_, DbState>, id: i64, input: BookInput) -> AppResult<Book> {
    books::update(&*state.conn()?, id, &input)
}

#[tauri::command]
pub async fn delete_book(state: State<'_, DbState>, id: i64) -> AppResult<()> {
    books::delete(&*state.conn()?, id)
}
