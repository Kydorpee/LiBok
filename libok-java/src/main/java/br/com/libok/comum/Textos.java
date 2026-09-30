package br.com.libok.comum;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

/** Normalização de textos usada em buscas e na detecção de duplicados. */
public final class Textos {

    private static final Pattern MARCAS = Pattern.compile("\\p{M}+");
    private static final Pattern ESPACOS = Pattern.compile("\\s+");

    private Textos() {
    }

    /** Remove espaços extras; devolve {@code null} para textos vazios. */
    public static String limpar(String valor) {
        if (valor == null) {
            return null;
        }
        String limpo = ESPACOS.matcher(valor.strip()).replaceAll(" ");
        return limpo.isEmpty() ? null : limpo;
    }

    /** Minúsculas, sem acentos e sem espaços extras: "  Ficção  Científica" vira "ficcao cientifica". */
    public static String normalizar(String valor) {
        String limpo = limpar(valor);
        if (limpo == null) {
            return "";
        }
        String semAcentos = MARCAS.matcher(Normalizer.normalize(limpo, Normalizer.Form.NFKD)).replaceAll("");
        return semAcentos.toLowerCase(Locale.ROOT);
    }

    /** Códigos de exemplar são comparados sem diferenciar maiúsculas, acentos e espaços. */
    public static String normalizarCodigo(String codigo) {
        return normalizar(codigo).toUpperCase(Locale.ROOT);
    }
}
