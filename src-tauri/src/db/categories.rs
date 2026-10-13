//! Repositório de categorias.

use super::map_write_err;
use super::normalize::normalize;
use crate::error::{AppError, AppResult};
use rusqlite::{Connection, OptionalExtension, params};
use serde::Serialize;

/// Paleta padrão para novas categorias (briefing §7).
pub const PALETTE: [&str; 8] = [
    "#8C6E5D", "#4F6D7A", "#A44A3F", "#6B705C", "#6D597A", "#277DA1", "#F9844A", "#43AA8B",
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub color: String,
    pub book_count: i64,
}

const SELECT: &str = "SELECT c.id, c.name, c.color,
        (SELECT COUNT(*) FROM books b WHERE b.category_id = c.id)
     FROM categories c";

fn map_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        name: row.get(1)?,
        color: row.get(2)?,
        book_count: row.get(3)?,
    })
}

/// Todas as categorias ordenadas por nome (sem acento).
pub fn list(conn: &Connection) -> AppResult<Vec<Category>> {
    let mut stmt = conn.prepare(&format!("{SELECT} ORDER BY c.name_norm"))?;
    let rows = stmt.query_map([], map_row)?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn get(conn: &Connection, id: i64) -> AppResult<Category> {
    conn.query_row(&format!("{SELECT} WHERE c.id = ?1"), [id], map_row)
        .optional()?
        .ok_or_else(|| AppError::not_found("Categoria não encontrada."))
}

fn valid_color(color: &str) -> bool {
    let b = color.as_bytes();
    b.len() == 7 && b[0] == b'#' && b[1..].iter().all(u8::is_ascii_hexdigit)
}

fn check_name(
    conn: &Connection,
    name: &str,
    except_id: Option<i64>,
) -> AppResult<(String, String)> {
    let name = super::require("name", "o nome da categoria", name)?;
    let norm = normalize(&name);
    let dup: Option<i64> = conn
        .query_row(
            "SELECT id FROM categories WHERE name_norm = ?1 AND id IS NOT ?2",
            params![norm, except_id],
            |r| r.get(0),
        )
        .optional()?;
    if dup.is_some() {
        return Err(AppError::validation(
            "name",
            "Já existe uma categoria com esse nome.",
        ));
    }
    Ok((name, norm))
}

fn next_color(conn: &Connection) -> AppResult<String> {
    let count: i64 = conn.query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))?;
    Ok(PALETTE[(count as usize) % PALETTE.len()].to_string())
}

/// Cria categoria; sem `color`, usa a próxima cor da paleta.
pub fn create(conn: &Connection, name: &str, color: Option<&str>) -> AppResult<Category> {
    let (name, norm) = check_name(conn, name, None)?;
    let color = match color.map(str::trim).filter(|c| !c.is_empty()) {
        Some(c) if valid_color(c) => c.to_string(),
        Some(_) => return Err(AppError::validation("color", "Cor inválida; use #RRGGBB.")),
        None => next_color(conn)?,
    };
    conn.execute(
        "INSERT INTO categories (name, name_norm, color) VALUES (?1, ?2, ?3)",
        params![name, norm, color],
    )
    .map_err(map_write_err)?;
    get(conn, conn.last_insert_rowid())
}

pub fn update(conn: &Connection, id: i64, name: &str, color: &str) -> AppResult<Category> {
    get(conn, id)?;
    let (name, norm) = check_name(conn, name, Some(id))?;
    let color = color.trim();
    if !valid_color(color) {
        return Err(AppError::validation("color", "Cor inválida; use #RRGGBB."));
    }
    conn.execute(
        "UPDATE categories SET name = ?1, name_norm = ?2, color = ?3 WHERE id = ?4",
        params![name, norm, color, id],
    )
    .map_err(map_write_err)?;
    get(conn, id)
}

/// Busca a categoria pelo nome normalizado ou a cria (usado na importação de CSV).
pub(crate) fn find_or_create(conn: &Connection, name: &str) -> AppResult<i64> {
    let norm = normalize(name);
    let found: Option<i64> = conn
        .query_row(
            "SELECT id FROM categories WHERE name_norm = ?1",
            [&norm],
            |r| r.get(0),
        )
        .optional()?;
    match found {
        Some(id) => Ok(id),
        None => Ok(create(conn, name, None)?.id),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::testutil::db;

    #[test]
    fn lista_seed_ordenada() {
        let conn = db();
        let cats = list(&conn).unwrap();
        assert_eq!(cats.len(), 7);
        assert_eq!(cats[0].name, "Educativo");
        assert!(cats.iter().all(|c| c.book_count == 0));
    }

    #[test]
    fn cria_com_cor_da_paleta_e_bloqueia_duplicada_sem_acento() {
        let conn = db();
        let c = create(&conn, "  Poesia ", None).unwrap();
        assert_eq!(c.name, "Poesia");
        assert!(PALETTE.contains(&c.color.as_str()));
        let err = create(&conn, "HISTORIA", None).unwrap_err();
        assert_eq!(err.field.as_deref(), Some("name"));
    }

    #[test]
    fn atualiza_e_valida_cor() {
        let conn = db();
        let c = create(&conn, "Poesia", None).unwrap();
        let u = update(&conn, c.id, "Poesias", "#112233").unwrap();
        assert_eq!((u.name.as_str(), u.color.as_str()), ("Poesias", "#112233"));
        assert!(update(&conn, c.id, "Poesias", "azul").is_err());
        assert!(update(&conn, 9999, "x", "#112233").is_err());
    }

    #[test]
    fn find_or_create_reaproveita() {
        let conn = db();
        let a = find_or_create(&conn, "Ficção").unwrap();
        let b = find_or_create(&conn, "ficcao").unwrap();
        assert_eq!(a, b);
        let n = find_or_create(&conn, "Nova").unwrap();
        assert_ne!(n, a);
    }
}
