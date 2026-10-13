//! Exportação, prévia e importação de CSV (UTF-8 com BOM, separador `;`).
//!
//! Formato do LiBok v2: `titulo;autor;categoria;assunto;codigos` (códigos separados por `|`).
//! Também aceita o CSV da v1 (`Nome do livro;Autor;Categoria;Assunto;Quantidade;Codigos de
//! registro`, códigos separados por vírgula) e arquivos em Windows-1252 salvos pelo Excel.
//!
//! Células de texto que começam com `= + - @`, tab ou CR saem com `'` na frente (neutraliza
//! fórmulas no Excel); a importação remove esse prefixo.

use super::books::{self, BookInput};
use super::categories;
use super::normalize::normalize;
use crate::error::{AppError, AppResult};
use rusqlite::Connection;
use serde::Serialize;
use std::borrow::Cow;
use std::collections::HashSet;
use std::io::Write;
use std::path::Path;

const BOM: [u8; 3] = [0xEF, 0xBB, 0xBF];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RowStatus {
    Ready,
    Duplicate,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvPreviewRow {
    pub line: u64,
    pub title: String,
    pub author: String,
    pub subject: String,
    pub category_name: String,
    pub codes: Vec<String>,
    pub status: RowStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewCounts {
    pub ready: i64,
    pub duplicate: i64,
    pub error: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CsvPreview {
    pub rows: Vec<CsvPreviewRow>,
    pub counts: PreviewCounts,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportError {
    pub line: u64,
    pub message: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportReport {
    pub imported: i64,
    pub skipped_duplicates: Vec<String>,
    pub errors: Vec<ImportError>,
}

// ---------------------------------------------------------------------------
// Exportação
// ---------------------------------------------------------------------------

/// Exporta todo o acervo. Retorna o número de linhas (livros) gravadas.
pub fn export(conn: &Connection, path: &Path) -> AppResult<usize> {
    super::backup::ensure_not_live(conn, path)?;
    let mut stmt = conn.prepare(
        "SELECT b.id, b.title, b.author, c.name, b.subject
         FROM books b JOIN categories c ON c.id = b.category_id
         ORDER BY b.title_norm, b.id",
    )?;
    let books: Vec<(i64, String, String, String, String)> = stmt
        .query_map([], |r| {
            Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
        })?
        .collect::<Result<_, _>>()?;
    let mut codes_stmt =
        conn.prepare("SELECT registration_code FROM copies WHERE book_id = ?1 ORDER BY id")?;

    let mut file = std::fs::File::create(path)?;
    file.write_all(&BOM)?;
    let mut writer = ::csv::WriterBuilder::new()
        .delimiter(b';')
        .from_writer(file);
    writer.write_record(["titulo", "autor", "categoria", "assunto", "codigos"])?;
    for (id, title, author, category, subject) in &books {
        let codes: Vec<String> = codes_stmt
            .query_map([id], |r| r.get(0))?
            .collect::<Result<_, _>>()?;
        writer.write_record([
            &*escape_cell(title),
            &*escape_cell(author),
            &*escape_cell(category),
            &*escape_cell(subject),
            &*escape_cell(&codes.join("|")),
        ])?;
    }
    writer.flush()?;
    Ok(books.len())
}

/// Caracteres que o Excel interpreta como início de fórmula.
fn is_formula_start(c: char) -> bool {
    matches!(c, '=' | '+' | '-' | '@' | '\t' | '\r')
}

/// Neutraliza injeção de fórmula: prefixa com `'` células que começam com `= + - @`, tab ou CR.
fn escape_cell(value: &str) -> Cow<'_, str> {
    if value.chars().next().is_some_and(is_formula_start) {
        Cow::Owned(format!("'{value}"))
    } else {
        Cow::Borrowed(value)
    }
}

/// Inverso de [`escape_cell`]: remove o `'` quando seguido de um desses caracteres.
fn unescape_cell(value: &str) -> &str {
    match value.strip_prefix('\'') {
        Some(rest) if rest.chars().next().is_some_and(is_formula_start) => rest,
        _ => value,
    }
}

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

struct Parsed {
    line: u64,
    title: String,
    author: String,
    category: String,
    subject: String,
    codes: Vec<String>,
    error: Option<String>,
}

/// Windows-1252, bytes 0x80..=0x9F (o resto coincide com Latin-1). Os cinco
/// indefinidos (81, 8D, 8F, 90, 9D) viram o controle C1 correspondente.
const CP1252_HIGH: [char; 32] = [
    '\u{20AC}', '\u{81}', '\u{201A}', '\u{192}', '\u{201E}', '\u{2026}', '\u{2020}', '\u{2021}',
    '\u{2C6}', '\u{2030}', '\u{160}', '\u{2039}', '\u{152}', '\u{8D}', '\u{17D}', '\u{8F}',
    '\u{90}', '\u{2018}', '\u{2019}', '\u{201C}', '\u{201D}', '\u{2022}', '\u{2013}', '\u{2014}',
    '\u{2DC}', '\u{2122}', '\u{161}', '\u{203A}', '\u{153}', '\u{9D}', '\u{17E}', '\u{178}',
];

fn cp1252(bytes: &[u8]) -> String {
    bytes
        .iter()
        .map(|&b| match b {
            0x80..=0x9F => CP1252_HIGH[usize::from(b - 0x80)],
            _ => char::from(b),
        })
        .collect()
}

/// Decodifica UTF-8 (com ou sem BOM); se inválido, assume Windows-1252 (Excel pt-BR).
fn decode(bytes: &[u8]) -> String {
    let bytes = bytes.strip_prefix(&BOM).unwrap_or(bytes);
    match std::str::from_utf8(bytes) {
        Ok(s) => s.to_string(),
        Err(_) => cp1252(bytes),
    }
}

fn detect_delimiter(text: &str) -> u8 {
    let first = text.lines().next().unwrap_or("");
    let count = |c: char| first.matches(c).count();
    let (semi, comma, tab) = (count(';'), count(','), count('\t'));
    if semi >= comma && semi >= tab {
        b';'
    } else if comma >= tab {
        b','
    } else {
        b'\t'
    }
}

fn find_col(headers: &[String], aliases: &[&str]) -> Option<usize> {
    headers.iter().position(|h| aliases.contains(&h.as_str()))
}

fn split_codes(raw: &str) -> Vec<String> {
    raw.split(['|', ',', ';', '\n', '\r'])
        .map(str::trim)
        .filter(|c| !c.is_empty())
        .map(str::to_string)
        .collect()
}

fn parse(path: &Path) -> AppResult<Vec<Parsed>> {
    let text = decode(&std::fs::read(path)?);
    let mut reader = ::csv::ReaderBuilder::new()
        .delimiter(detect_delimiter(&text))
        .flexible(true)
        .from_reader(text.as_bytes());

    let headers: Vec<String> = reader.headers()?.iter().map(normalize).collect();
    let title_c = find_col(
        &headers,
        &["titulo", "nome do livro", "nome", "livro", "title"],
    );
    let author_c = find_col(&headers, &["autor", "author"]);
    let category_c = find_col(&headers, &["categoria", "category"]);
    let subject_c = find_col(&headers, &["assunto", "subject"]);
    let codes_c = find_col(
        &headers,
        &[
            "codigos",
            "codigos de registro",
            "codigo",
            "codigo de registro",
            "codes",
        ],
    );
    let qty_c = find_col(&headers, &["quantidade", "qtd"]);
    let (Some(title_c), Some(author_c), Some(category_c), Some(subject_c), Some(codes_c)) =
        (title_c, author_c, category_c, subject_c, codes_c)
    else {
        return Err(AppError::validation(
            "path",
            "O CSV precisa ter as colunas: titulo, autor, categoria, assunto e codigos.",
        ));
    };

    let mut out = Vec::new();
    for record in reader.records() {
        let record = record?;
        if record.iter().all(|f| f.trim().is_empty()) {
            continue;
        }
        let line = record.position().map_or(0, |p| p.line());
        let get = |i: usize| {
            unescape_cell(record.get(i).unwrap_or(""))
                .trim()
                .to_string()
        };
        let mut row = Parsed {
            line,
            title: get(title_c),
            author: get(author_c),
            category: get(category_c),
            subject: get(subject_c),
            codes: split_codes(&get(codes_c)),
            error: None,
        };
        row.error = validate_row(&row, qty_c.map(&get));
        out.push(row);
    }
    Ok(out)
}

fn validate_row(row: &Parsed, quantity: Option<String>) -> Option<String> {
    if row.title.is_empty()
        || row.author.is_empty()
        || row.category.is_empty()
        || row.subject.is_empty()
    {
        return Some("Existem campos obrigatórios vazios.".into());
    }
    if row.codes.is_empty() {
        return Some("Informe ao menos um código de registro.".into());
    }
    let mut seen = HashSet::new();
    if let Some(dup) = row.codes.iter().find(|c| !seen.insert(c.to_lowercase())) {
        return Some(format!("O código {dup} está repetido na linha."));
    }
    if let Some(q) = quantity.filter(|q| !q.is_empty()) {
        match q.parse::<usize>() {
            Ok(n) if n == row.codes.len() => {}
            Ok(_) => return Some("A quantidade não corresponde aos códigos informados.".into()),
            Err(_) => return Some("Quantidade inválida.".into()),
        }
    }
    None
}

/// Classifica cada linha (pronta / duplicada / com erro) sem gravar nada.
fn analyze(
    conn: &Connection,
    parsed: Vec<Parsed>,
) -> AppResult<Vec<(Parsed, RowStatus, Option<String>)>> {
    let mut seen_titles = HashSet::new();
    let mut seen_codes = HashSet::new();
    let mut out = Vec::with_capacity(parsed.len());
    for row in parsed {
        if let Some(msg) = row.error.clone() {
            out.push((row, RowStatus::Error, Some(msg)));
            continue;
        }
        let title_norm = normalize(&row.title);
        let mut dup: Option<String> = None;
        if seen_titles.contains(&title_norm) || books::title_exists(conn, &title_norm, None)? {
            dup = Some("Já existe um livro com esse título.".into());
        } else {
            for code in &row.codes {
                if seen_codes.contains(&code.to_lowercase()) || books::code_exists(conn, code)? {
                    dup = Some(format!("O código {code} já está cadastrado."));
                    break;
                }
            }
        }
        match dup {
            Some(msg) => out.push((row, RowStatus::Duplicate, Some(msg))),
            None => {
                seen_titles.insert(title_norm);
                seen_codes.extend(row.codes.iter().map(|c| c.to_lowercase()));
                out.push((row, RowStatus::Ready, None));
            }
        }
    }
    Ok(out)
}

/// Prévia do arquivo: cada linha com status `ready`/`duplicate`/`error`. Não grava nada.
pub fn preview(conn: &Connection, path: &Path) -> AppResult<CsvPreview> {
    let analyzed = analyze(conn, parse(path)?)?;
    let mut counts = PreviewCounts::default();
    let rows = analyzed
        .into_iter()
        .map(|(row, status, message)| {
            match status {
                RowStatus::Ready => counts.ready += 1,
                RowStatus::Duplicate => counts.duplicate += 1,
                RowStatus::Error => counts.error += 1,
            }
            CsvPreviewRow {
                line: row.line,
                title: row.title,
                author: row.author,
                subject: row.subject,
                category_name: row.category,
                codes: row.codes,
                status,
                message,
            }
        })
        .collect();
    Ok(CsvPreview { rows, counts })
}

/// Importa as linhas prontas numa única transação. Duplicadas e inválidas são
/// ignoradas e relatadas; categorias novas são criadas com cor da paleta.
pub fn import(conn: &Connection, path: &Path) -> AppResult<ImportReport> {
    let analyzed = analyze(conn, parse(path)?)?;
    let tx = conn.unchecked_transaction()?;
    let mut report = ImportReport {
        imported: 0,
        skipped_duplicates: Vec::new(),
        errors: Vec::new(),
    };
    for (row, status, message) in analyzed {
        match status {
            RowStatus::Duplicate => report.skipped_duplicates.push(row.title),
            RowStatus::Error => report.errors.push(ImportError {
                line: row.line,
                message: message.unwrap_or_default(),
            }),
            RowStatus::Ready => {
                tx.execute_batch("SAVEPOINT import_row")?;
                let result =
                    categories::find_or_create(&tx, &row.category).and_then(|category_id| {
                        books::insert_in(
                            &tx,
                            &BookInput {
                                title: row.title.clone(),
                                author: row.author.clone(),
                                subject: row.subject.clone(),
                                category_id,
                                codes: row.codes.clone(),
                            },
                        )
                    });
                match result {
                    Ok(_) => {
                        tx.execute_batch("RELEASE import_row")?;
                        report.imported += 1;
                    }
                    Err(err) => {
                        tx.execute_batch("ROLLBACK TO import_row; RELEASE import_row")?;
                        report.errors.push(ImportError {
                            line: row.line,
                            message: err.message,
                        });
                    }
                }
            }
        }
    }
    tx.commit()?;
    Ok(report)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::books::BookQuery;
    use crate::db::testutil::{book, db};
    use std::path::PathBuf;

    fn tmp(name: &str, content: &[u8]) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("libok-csv-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        std::fs::write(&path, content).unwrap();
        path
    }

    #[test]
    fn exporta_com_bom_ponto_e_virgula_e_cabecalho() {
        let conn = db();
        book(&conn, "História Geral", &["H1", "H2"]);
        let path = tmp("export.csv", b"");
        assert_eq!(export(&conn, &path).unwrap(), 1);
        let bytes = std::fs::read(&path).unwrap();
        assert_eq!(&bytes[..3], &BOM);
        let text = String::from_utf8(bytes[3..].to_vec()).unwrap();
        let mut lines = text.lines();
        assert_eq!(lines.next(), Some("titulo;autor;categoria;assunto;codigos"));
        assert_eq!(
            lines.next(),
            Some("História Geral;Autor Teste;Romance;Assunto;H1|H2")
        );
    }

    #[test]
    fn round_trip_exporta_e_importa_em_outro_banco() {
        let src = db();
        book(&src, "Livro; com ponto e vírgula", &["A1"]);
        book(&src, "Outro \"citado\"", &["B1", "B2"]);
        let path = tmp("roundtrip.csv", b"");
        export(&src, &path).unwrap();

        let dst = db();
        let report = import(&dst, &path).unwrap();
        assert_eq!(report.imported, 2);
        assert!(report.skipped_duplicates.is_empty() && report.errors.is_empty());
        let all = books::list(&dst, &BookQuery::default()).unwrap();
        assert_eq!(all.total, 2);
        let b = all
            .items
            .iter()
            .find(|b| b.title.starts_with("Outro"))
            .unwrap();
        assert_eq!(b.title, "Outro \"citado\"");
        assert_eq!(b.codes, vec!["B1", "B2"]);
        assert_eq!(b.category.name, "Romance");

        // reimportar tudo: só duplicados
        let again = import(&dst, &path).unwrap();
        assert_eq!(again.imported, 0);
        assert_eq!(again.skipped_duplicates.len(), 2);
    }

    #[test]
    fn aceita_csv_da_v1_e_cria_categoria() {
        let v1 = "Nome do livro;Autor;Categoria;Assunto;Quantidade;Codigos de registro\r\n\
                  Dom Casmurro;Machado;Poesia Nova;Romance;2;A1, A2\r\n";
        let mut bytes = BOM.to_vec();
        bytes.extend_from_slice(v1.as_bytes());
        let path = tmp("v1.csv", &bytes);
        let conn = db();
        let before = categories::list(&conn).unwrap().len();
        let report = import(&conn, &path).unwrap();
        assert_eq!(report.imported, 1);
        let b = &books::list(&conn, &BookQuery::default()).unwrap().items[0];
        assert_eq!(b.codes, vec!["A1", "A2"]);
        assert_eq!(b.category.name, "Poesia Nova");
        assert_eq!(categories::list(&conn).unwrap().len(), before + 1);
    }

    #[test]
    fn aceita_latin1_do_excel() {
        let (a, b) = (
            "titulo;autor;categoria;assunto;codigos\r\n",
            "Educação;José;Educativo;Pedagogia;E1\r\n",
        );
        let mut bytes = a.as_bytes().to_vec();
        // "Educação;José" em Latin-1
        bytes.extend(b.chars().map(|c| c as u32 as u8));
        let path = tmp("latin1.csv", &bytes);
        let conn = db();
        assert_eq!(import(&conn, &path).unwrap().imported, 1);
        let item = &books::list(&conn, &BookQuery::default()).unwrap().items[0];
        assert_eq!(item.title, "Educação");
        assert_eq!(item.author, "José");
    }

    #[test]
    fn decodifica_windows_1252_com_aspas_curvas() {
        // 0x93/0x94 = aspas curvas, 0x96 = travessão, 0x80 = euro, 0xE7 = ç, 0xE3 = ã
        let mut bytes = b"titulo;autor;categoria;assunto;codigos\r\n".to_vec();
        bytes.extend_from_slice(b"\x93Cora\xe7\xe3o\x94 \x96 \x80;Autor;Romance;S;C1\r\n");
        let conn = db();
        assert_eq!(
            import(&conn, &tmp("cp1252.csv", &bytes)).unwrap().imported,
            1
        );
        let item = &books::list(&conn, &BookQuery::default()).unwrap().items[0];
        assert_eq!(item.title, "\u{201C}Coração\u{201D} \u{2013} \u{20AC}");
    }

    #[test]
    fn neutraliza_formulas_na_exportacao_e_desfaz_na_importacao() {
        let src = db();
        let titles = [
            "=HYPERLINK(\"http://x\")",
            "+1 mais",
            "-menos",
            "@usuario",
            "\tTab",
        ];
        for (i, t) in titles.iter().enumerate() {
            let code = if i == 0 {
                "-C0".to_string()
            } else {
                format!("C{i}")
            };
            crate::db::books::create(
                &src,
                &BookInput {
                    title: (*t).into(),
                    author: "=SOMA(A1)".into(),
                    subject: "Assunto".into(),
                    category_id: 1,
                    codes: vec![code],
                },
            )
            .unwrap();
        }
        let path = tmp("formulas.csv", b"");
        export(&src, &path).unwrap();
        let raw = std::fs::read_to_string(&path).unwrap();
        assert!(raw.contains("'=HYPERLINK"), "{raw}");
        assert!(raw.contains(";'=SOMA(A1);"), "{raw}");
        assert!(raw.contains(";'-C0"), "{raw}");
        assert!(!raw.contains(";=SOMA") && !raw.lines().any(|l| l.starts_with('=')));

        let dst = db();
        let report = import(&dst, &path).unwrap();
        assert_eq!((report.imported, report.errors.len()), (5, 0), "{report:?}");
        let all = books::list(&dst, &BookQuery::default()).unwrap();
        for t in titles {
            // o trim da importação remove o tab inicial; o resto volta idêntico
            let expected = t.trim();
            assert!(all.items.iter().any(|b| b.title == expected), "falta {t:?}");
        }
        assert!(all.items.iter().all(|b| b.author == "=SOMA(A1)"));
        assert!(all.items.iter().any(|b| b.codes == vec!["-C0"]));
        // apóstrofo comum não é mexido
        assert_eq!(unescape_cell("'Quarto"), "'Quarto");
        assert_eq!(escape_cell("Normal"), "Normal");
    }

    #[test]
    fn csv_com_aspas_e_quebra_de_linha_no_campo() {
        let csv = "titulo;autor;categoria;assunto;codigos\n\"Linha um\nlinha dois\";A;Romance;S;Q1\nOutro;A;Romance;;Q2\n";
        let conn = db();
        let pv = preview(&conn, &tmp("multiline.csv", csv.as_bytes())).unwrap();
        assert_eq!(pv.rows.len(), 2);
        assert_eq!(pv.rows[0].title, "Linha um\nlinha dois");
        assert_eq!(pv.rows[1].status, RowStatus::Error);
        assert_eq!(pv.rows[1].line, 4, "linha física do registro");
    }

    #[test]
    fn export_recusa_o_banco_em_uso() {
        let d = std::env::temp_dir().join(format!("libok-csv-live-{}", std::process::id()));
        std::fs::create_dir_all(&d).unwrap();
        let live = d.join("libok.db");
        let conn = crate::db::open(&live).unwrap();
        book(&conn, "Livro", &["A1"]);
        for name in ["libok.db", "libok.db-wal", "libok.db-shm"] {
            let err = export(&conn, &d.join(name)).unwrap_err();
            assert_eq!(err.code, crate::error::ErrorCode::Validation, "{name}");
            assert_eq!(err.field.as_deref(), Some("path"));
        }
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 1);
        drop(conn);
        let _ = std::fs::remove_dir_all(&d);
    }

    #[test]
    fn linhas_invalidas_duplicadas_e_prontas() {
        let conn = db();
        book(&conn, "Existente", &["X1"]);
        let csv = "titulo;autor;categoria;assunto;codigos\n\
                   Novo 1;A;Romance;S;N1|N2\n\
                   ;A;Romance;S;N3\n\
                   Sem codigo;A;Romance;S;\n\
                   EXISTENTE;A;Romance;S;N4\n\
                   Codigo repetido;A;Romance;S;X1\n\
                   Novo 1;A;Romance;S;N5\n\
                   Dentro repetido;A;Romance;S;D1|d1\n\
                   Novo 2;A;Romance;S;N6\n";
        let path = tmp("mixed.csv", csv.as_bytes());

        let pv = preview(&conn, &path).unwrap();
        assert_eq!(
            pv.counts,
            PreviewCounts {
                ready: 2,
                duplicate: 3,
                error: 3
            }
        );
        assert_eq!(pv.rows.len(), 8);
        assert_eq!(pv.rows[0].status, RowStatus::Ready);
        assert_eq!(pv.rows[0].codes, vec!["N1", "N2"]);
        assert_eq!(pv.rows[0].category_name, "Romance");
        assert_eq!(pv.rows[1].status, RowStatus::Error);
        assert_eq!(pv.rows[1].line, 3);
        // prévia não grava
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 1);

        let report = import(&conn, &path).unwrap();
        assert_eq!(report.imported, 2);
        assert_eq!(
            report.skipped_duplicates,
            vec!["EXISTENTE", "Codigo repetido", "Novo 1"]
        );
        assert_eq!(report.errors.len(), 3);
        assert_eq!(report.errors[0].line, 3);
        assert_eq!(books::list(&conn, &BookQuery::default()).unwrap().total, 3);
    }

    #[test]
    fn quantidade_divergente_e_erro() {
        let csv = "Nome do livro;Autor;Categoria;Assunto;Quantidade;Codigos de registro\n\
                   L;A;Romance;S;3;A1,A2\n";
        let conn = db();
        let report = import(&conn, &tmp("qty.csv", csv.as_bytes())).unwrap();
        assert_eq!((report.imported, report.errors.len()), (0, 1));
    }

    #[test]
    fn cabecalho_invalido_e_rejeitado_sem_gravar() {
        let conn = db();
        let path = tmp("bad.csv", b"a;b;c\n1;2;3\n");
        let err = import(&conn, &path).unwrap_err();
        assert_eq!(err.code, crate::error::ErrorCode::Validation);
        assert!(import(&conn, Path::new("nao-existe-xyz.csv")).is_err());
    }
}
