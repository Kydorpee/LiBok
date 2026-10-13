//! Handlers IPC (`#[tauri::command]`) do LiBok — área do libok-tauri-rust.
//!
//! Cada command trava o [`DbState`], delega ao repositório de `crate::db`
//! (nenhum SQL aqui) e retorna `Result<T, AppError>` conforme o contrato do
//! briefing §5. Os nomes dos argumentos seguem as convenções do §5: o Tauri
//! converte `snake_case` do Rust para `camelCase` no `invoke`
//! (`book_id` → `bookId`, `returned_at` → `returnedAt`).
//!
//! Todos os commands são `async` para rodar fora da thread principal (no
//! Tauri v2, um command síncrono sem `#[tauri::command(async)]` roda na thread
//! principal e congelaria a janela). Os commands de arquivo (`files.rs`) ainda
//! levam o trabalho para `spawn_blocking`, para não ocupar um worker do
//! runtime assíncrono durante importações, exportações e backups grandes.

pub mod books;
pub mod categories;
pub mod classes;
pub mod files;
pub mod loans;
pub mod readers;
pub mod readings;
pub mod stats;
pub mod students;
pub mod teachers;

use chrono::NaiveDate;

/// "Hoje" na data local da máquina (briefing §4).
pub(crate) fn today() -> NaiveDate {
    chrono::Local::now().date_naive()
}

/// Handler com todos os commands do contrato IPC (usado pelo app e pelos testes).
pub fn handler<R: tauri::Runtime>() -> impl Fn(tauri::ipc::Invoke<R>) -> bool + Send + Sync + 'static
{
    tauri::generate_handler![
        // livros
        books::list_books,
        books::get_book,
        books::create_book,
        books::update_book,
        books::delete_book,
        // categorias
        categories::list_categories,
        categories::create_category,
        categories::update_category,
        // dashboard
        stats::get_stats,
        // csv / backup
        files::export_csv,
        files::preview_csv,
        files::import_csv,
        files::validate_import_rows,
        files::import_rows,
        files::backup_db,
        files::restore_db,
        // turmas
        classes::list_classes,
        classes::get_class,
        classes::create_class,
        classes::update_class,
        classes::delete_class,
        // professores
        teachers::list_teachers,
        teachers::create_teacher,
        teachers::update_teacher,
        teachers::delete_teacher,
        // alunos
        students::list_students,
        students::get_student,
        students::create_student,
        students::update_student,
        students::delete_student,
        // leitores
        readers::search_readers,
        readers::get_reader_summary,
        // empréstimos
        loans::list_copy_status,
        loans::create_loan,
        loans::return_loan,
        loans::list_loans,
        // leituras coletivas
        readings::list_class_readings,
        readings::create_class_reading,
        readings::delete_class_reading,
    ]
}

#[cfg(test)]
mod tests;
