pub mod commands;
pub mod db;
pub mod error;
pub mod state;

use state::DbState;
use std::fs;
use tauri::Manager;

/// Nome do arquivo do banco dentro de `app_data_dir()`.
pub const DB_FILE: &str = "libok.db";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
        // Log no stdout e em `app_log_dir()` (Windows: %LOCALAPPDATA%\com.libok.app\logs).
        // Só o lado Rust registra; o front não recebe permissão `log:*`.
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                // Hora local da máquina, como as datas exibidas no app.
                .timezone_strategy(tauri_plugin_log::TimezoneStrategy::UseLocal)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let conn = db::open(&data_dir.join(DB_FILE))?;
            app.manage(DbState::new(conn));
            Ok(())
        })
        .invoke_handler(commands::handler())
        .run(tauri::generate_context!());

    if let Err(err) = result {
        eprintln!("Falha ao executar o LiBok: {err}");
        std::process::exit(1);
    }
}
