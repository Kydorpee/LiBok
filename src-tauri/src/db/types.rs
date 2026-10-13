//! Tipos compartilhados entre repositórios (espelham o contrato IPC, briefing §5).

use rusqlite::types::{FromSql, FromSqlError, FromSqlResult, ValueRef};
use serde::{Deserialize, Serialize};

/// `Page<T>` do contrato.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Page<T> {
    pub items: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub page_size: i64,
}

/// `Ref` do contrato: `{ id, name }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Ref {
    pub id: i64,
    pub name: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReaderKind {
    Student,
    Teacher,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Shift {
    Morning,
    Afternoon,
    Evening,
    Fullday,
}

impl Shift {
    pub fn as_str(self) -> &'static str {
        match self {
            Shift::Morning => "morning",
            Shift::Afternoon => "afternoon",
            Shift::Evening => "evening",
            Shift::Fullday => "fullday",
        }
    }
}

impl FromSql for Shift {
    fn column_result(value: ValueRef<'_>) -> FromSqlResult<Self> {
        match value.as_str()? {
            "morning" => Ok(Shift::Morning),
            "afternoon" => Ok(Shift::Afternoon),
            "evening" => Ok(Shift::Evening),
            "fullday" => Ok(Shift::Fullday),
            other => Err(FromSqlError::Other(
                format!("turno inválido no banco: {other}").into(),
            )),
        }
    }
}

/// Leitor (aluno ou professor) em listas, buscas e empréstimos.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Reader {
    pub kind: ReaderKind,
    pub id: i64,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub class_label: Option<String>,
    pub active_loans: i64,
    pub overdue_loans: i64,
}

/// Leitura coletiva da turma (`ClassReading` do contrato).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassReading {
    pub id: i64,
    pub class_room: Ref,
    pub book: super::loans::LoanBook,
    pub read_at: String,
    pub present_count: i64,
    pub class_size: i64,
    /// Presentes, em ordem alfabética.
    pub students: Vec<Ref>,
    pub created_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClassReadingInput {
    pub class_id: i64,
    pub book_id: i64,
    pub read_at: String,
    pub student_ids: Vec<i64>,
}
