//! Erro compartilhado por todos os commands IPC.
//!
//! Serializa como `{ code, message, field? }`, espelhando o tipo `AppError`
//! do contrato IPC (briefing §5).

use serde::Serialize;
use std::sync::PoisonError;

/// Códigos de erro do contrato IPC (serializados em `SCREAMING_SNAKE_CASE`).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    Validation,
    DuplicateTitle,
    DuplicateCode,
    DuplicateRegistration,
    CopyUnavailable,
    HasActiveLoans,
    InUse,
    NotFound,
    Io,
    Db,
}

/// Erro retornado por todo command: `Result<T, AppError>`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, thiserror::Error)]
#[serde(rename_all = "camelCase")]
#[error("{message}")]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            field: None,
        }
    }

    /// Associa o erro a um campo de formulário (o front destaca o campo).
    pub fn with_field(mut self, field: impl Into<String>) -> Self {
        self.field = Some(field.into());
        self
    }

    pub fn validation(field: impl Into<String>, message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Validation, message).with_field(field)
    }

    pub fn duplicate_title(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::DuplicateTitle, message).with_field("title")
    }

    pub fn duplicate_code(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::DuplicateCode, message).with_field("codes")
    }

    pub fn duplicate_registration(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::DuplicateRegistration, message).with_field("registration")
    }

    pub fn copy_unavailable(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::CopyUnavailable, message)
    }

    pub fn has_active_loans(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::HasActiveLoans, message)
    }

    pub fn in_use(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InUse, message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotFound, message)
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Io, message)
    }

    pub fn db(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Db, message)
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        match err {
            rusqlite::Error::QueryReturnedNoRows => Self::not_found("Registro não encontrado."),
            other => Self::db(format!("Erro no banco de dados: {other}")),
        }
    }
}

impl From<rusqlite_migration::Error> for AppError {
    fn from(err: rusqlite_migration::Error) -> Self {
        Self::db(format!("Erro ao atualizar o banco de dados: {err}"))
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::io(format!("Erro de arquivo: {err}"))
    }
}

impl From<csv::Error> for AppError {
    fn from(err: csv::Error) -> Self {
        Self::io(format!("Erro ao ler/escrever CSV: {err}"))
    }
}

impl From<tauri::Error> for AppError {
    fn from(err: tauri::Error) -> Self {
        Self::io(format!("Erro do aplicativo: {err}"))
    }
}

impl<T> From<PoisonError<T>> for AppError {
    fn from(_: PoisonError<T>) -> Self {
        Self::db("A conexão com o banco ficou indisponível; reinicie o aplicativo.")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn serializa_sem_field() {
        let err = AppError::not_found("Livro não encontrado.");
        assert_eq!(
            serde_json::to_value(&err).ok(),
            Some(json!({ "code": "NOT_FOUND", "message": "Livro não encontrado." }))
        );
    }

    #[test]
    fn serializa_com_field() {
        let err = AppError::duplicate_registration("Matrícula já cadastrada.");
        assert_eq!(
            serde_json::to_value(&err).ok(),
            Some(json!({
                "code": "DUPLICATE_REGISTRATION",
                "message": "Matrícula já cadastrada.",
                "field": "registration"
            }))
        );
    }

    #[test]
    fn todos_os_codigos_do_contrato() {
        let codes = [
            (ErrorCode::Validation, "VALIDATION"),
            (ErrorCode::DuplicateTitle, "DUPLICATE_TITLE"),
            (ErrorCode::DuplicateCode, "DUPLICATE_CODE"),
            (ErrorCode::DuplicateRegistration, "DUPLICATE_REGISTRATION"),
            (ErrorCode::CopyUnavailable, "COPY_UNAVAILABLE"),
            (ErrorCode::HasActiveLoans, "HAS_ACTIVE_LOANS"),
            (ErrorCode::InUse, "IN_USE"),
            (ErrorCode::NotFound, "NOT_FOUND"),
            (ErrorCode::Io, "IO"),
            (ErrorCode::Db, "DB"),
        ];
        for (code, expected) in codes {
            assert_eq!(serde_json::to_value(code).ok(), Some(json!(expected)));
        }
    }

    #[test]
    fn no_rows_vira_not_found() {
        let err: AppError = rusqlite::Error::QueryReturnedNoRows.into();
        assert_eq!(err.code, ErrorCode::NotFound);
    }
}
