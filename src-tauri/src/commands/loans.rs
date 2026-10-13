//! Commands de empréstimos: `list_copy_status`, `create_loan`, `return_loan`, `list_loans`.

use super::today;
use crate::db::loans::{self, CopyStatus, Loan, LoanInput, LoanPage, LoanQuery};
use crate::error::AppResult;
use crate::state::DbState;
use tauri::State;

#[tauri::command]
pub async fn list_copy_status(
    state: State<'_, DbState>,
    book_id: i64,
) -> AppResult<Vec<CopyStatus>> {
    loans::list_copy_status(&*state.conn()?, book_id, today())
}

#[tauri::command]
pub async fn create_loan(state: State<'_, DbState>, input: LoanInput) -> AppResult<Loan> {
    loans::create(&*state.conn()?, &input, today())
}

#[tauri::command]
pub async fn return_loan(
    state: State<'_, DbState>,
    id: i64,
    returned_at: String,
    marked_read: bool,
) -> AppResult<Loan> {
    loans::return_loan(&*state.conn()?, id, &returned_at, marked_read, today())
}

#[tauri::command]
pub async fn list_loans(state: State<'_, DbState>, query: LoanQuery) -> AppResult<LoanPage> {
    loans::list(&*state.conn()?, &query, today())
}
