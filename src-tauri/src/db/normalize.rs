//! Normalização de texto para busca e unicidade (equivalente à
//! `normalize_search_text` da v1): minúsculas, sem diacríticos, sem espaços
//! nas pontas e com espaços internos colapsados.

use unicode_normalization::{UnicodeNormalization, char::is_combining_mark};

/// Normaliza `input`: `"  História  Do Brasil "` -> `"historia do brasil"`.
pub fn normalize(input: &str) -> String {
    // NFKD (superconjunto da NFD): também reduz "º" -> "o", "²" -> "2", ligaduras etc.
    let stripped: String = input.nfkd().filter(|c| !is_combining_mark(*c)).collect();
    stripped
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Escapa `%`, `_` e `\` para uso em `LIKE ... ESCAPE '\'` e envolve em `%...%`.
pub fn like_contains(token: &str) -> String {
    let mut out = String::with_capacity(token.len() + 2);
    out.push('%');
    for ch in token.chars() {
        if matches!(ch, '%' | '_' | '\\') {
            out.push('\\');
        }
        out.push(ch);
    }
    out.push('%');
    out
}

/// Divide o texto de busca em tokens normalizados já prontos para `LIKE`.
pub fn like_tokens(text: &str) -> Vec<String> {
    normalize(text)
        .split(' ')
        .filter(|t| !t.is_empty())
        .map(like_contains)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ignora_caixa_acento_e_espacos() {
        assert_eq!(normalize("  História "), "historia");
        assert_eq!(normalize("HISTÓRIA"), normalize("historia"));
        assert_eq!(normalize("Ficção   Científica"), "ficcao cientifica");
        assert_eq!(normalize("Ação à Órfã Ü"), "acao a orfa u");
        assert_eq!(normalize("5º ano A"), "5o ano a");
    }

    #[test]
    fn vazio_continua_vazio() {
        assert_eq!(normalize("   "), "");
    }

    #[test]
    fn escapa_curingas_do_like() {
        assert_eq!(like_contains("100%_a\\b"), "%100\\%\\_a\\\\b%");
        assert_eq!(like_tokens("Ação  100%"), vec!["%acao%", "%100\\%%"]);
    }
}
