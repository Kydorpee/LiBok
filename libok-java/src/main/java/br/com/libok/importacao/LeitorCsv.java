package br.com.libok.importacao;

import br.com.libok.comum.Textos;
import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.Charset;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

/**
 * Lê planilhas CSV de livros. Aceita o formato exportado pelo LiBok (antigo e novo), separador
 * ";" ou ",", arquivos em UTF-8 ou salvos pelo Excel (Windows-1252) e cabeçalhos com variações
 * de acento e maiúsculas.
 */
@Component
public class LeitorCsv {

    enum Coluna {
        TITULO("Nome do livro", true, "nome do livro", "titulo", "nome", "livro"),
        AUTOR("Autor", true, "autor", "autora", "autores"),
        CATEGORIA("Categoria", true, "categoria", "genero"),
        ASSUNTO("Assunto", true, "assunto", "tema"),
        CODIGOS("Codigos de registro", true, "codigos de registro", "codigos", "codigo", "codigo de registro", "registro"),
        QUANTIDADE("Quantidade", false, "quantidade", "qtd", "copias", "exemplares"),
        ISBN("ISBN", false, "isbn"),
        ANO("Ano de publicacao", false, "ano de publicacao", "ano", "ano publicacao"),
        DESCRICAO("Descricao", false, "descricao", "sinopse");

        final String rotulo;
        final boolean obrigatoria;
        final Set<String> apelidos;

        Coluna(String rotulo, boolean obrigatoria, String... apelidos) {
            this.rotulo = rotulo;
            this.obrigatoria = obrigatoria;
            this.apelidos = Set.of(apelidos);
        }
    }

    public LeituraArquivo ler(byte[] conteudo) {
        String texto = decodificar(conteudo);
        if (texto.startsWith("﻿")) {
            texto = texto.substring(1);
        }
        if (texto.isBlank()) {
            return new LeituraArquivo(List.of(), List.of("O arquivo está vazio."));
        }

        CSVFormat formato = CSVFormat.DEFAULT.builder()
                .setDelimiter(detectarSeparador(texto))
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreEmptyLines(true)
                .setTrim(true)
                .setAllowMissingColumnNames(true)
                .setAllowDuplicateHeaderNames(true)
                .get();

        try (CSVParser parser = CSVParser.parse(new StringReader(texto), formato)) {
            Map<Coluna, String> colunas = mapearColunas(parser.getHeaderNames());
            List<String> faltando = Arrays.stream(Coluna.values())
                    .filter(coluna -> coluna.obrigatoria && !colunas.containsKey(coluna))
                    .map(coluna -> coluna.rotulo)
                    .toList();
            if (!faltando.isEmpty()) {
                return new LeituraArquivo(List.of(), List.of(
                        "Colunas obrigatórias não encontradas: " + String.join(", ", faltando)
                                + ". Use o mesmo formato do arquivo exportado pelo LiBok."));
            }

            List<LinhaImportacao> linhas = new ArrayList<>();
            List<String> erros = new ArrayList<>();
            for (CSVRecord registro : parser) {
                int numero = (int) parser.getCurrentLineNumber();
                String erro = lerLinha(registro, colunas, numero, linhas);
                if (erro != null) {
                    erros.add(String.format("Linha %04d: %s", numero, erro));
                }
            }
            return new LeituraArquivo(linhas, erros);
        } catch (IOException | UncheckedIOException | IllegalStateException | IllegalArgumentException erro) {
            return new LeituraArquivo(List.of(), List.of("Não foi possível ler o CSV: " + erro.getMessage()));
        }
    }

    private static String lerLinha(CSVRecord registro, Map<Coluna, String> colunas, int numero,
                                   List<LinhaImportacao> destino) {
        Map<Coluna, String> valores = new EnumMap<>(Coluna.class);
        colunas.forEach((coluna, cabecalho) -> {
            String valor = registro.isMapped(cabecalho) && registro.isSet(cabecalho) ? registro.get(cabecalho) : null;
            valores.put(coluna, Textos.limpar(valor));
        });
        if (valores.values().stream().allMatch(valor -> valor == null)) {
            return null;
        }

        List<String> vazios = Arrays.stream(Coluna.values())
                .filter(coluna -> coluna.obrigatoria && valores.get(coluna) == null)
                .map(coluna -> coluna.rotulo)
                .toList();
        if (!vazios.isEmpty()) {
            return "campos vazios (" + String.join(", ", vazios) + ").";
        }

        List<String> codigos = Arrays.stream(valores.get(Coluna.CODIGOS).split("[,|\\n]"))
                .map(Textos::limpar)
                .filter(codigo -> codigo != null)
                .toList();

        String quantidade = valores.get(Coluna.QUANTIDADE);
        if (quantidade != null) {
            try {
                if (Integer.parseInt(quantidade) != codigos.size()) {
                    return "a quantidade (" + quantidade + ") não corresponde aos " + codigos.size() + " código(s).";
                }
            } catch (NumberFormatException erro) {
                return "quantidade inválida (" + quantidade + ").";
            }
        }

        Integer ano = null;
        String anoTexto = valores.get(Coluna.ANO);
        if (anoTexto != null) {
            try {
                ano = Integer.parseInt(anoTexto);
            } catch (NumberFormatException erro) {
                return "ano de publicação inválido (" + anoTexto + ").";
            }
        }

        destino.add(new LinhaImportacao(numero, valores.get(Coluna.TITULO), valores.get(Coluna.AUTOR),
                valores.get(Coluna.CATEGORIA), valores.get(Coluna.ASSUNTO), codigos,
                valores.get(Coluna.ISBN), ano, valores.get(Coluna.DESCRICAO)));
        return null;
    }

    private static Map<Coluna, String> mapearColunas(List<String> cabecalhos) {
        Map<Coluna, String> mapa = new EnumMap<>(Coluna.class);
        for (String cabecalho : cabecalhos) {
            String normalizado = Textos.normalizar(cabecalho);
            Arrays.stream(Coluna.values())
                    .filter(coluna -> coluna.apelidos.contains(normalizado))
                    .findFirst()
                    .ifPresent(coluna -> mapa.putIfAbsent(coluna, cabecalho));
        }
        return mapa;
    }

    private static char detectarSeparador(String texto) {
        String primeiraLinha = texto.lines().findFirst().orElse("");
        long pontoEVirgula = primeiraLinha.chars().filter(caractere -> caractere == ';').count();
        long virgula = primeiraLinha.chars().filter(caractere -> caractere == ',').count();
        return virgula > pontoEVirgula ? ',' : ';';
    }

    /** UTF-8 quando válido; senão Windows-1252, a codificação do "CSV" salvo pelo Excel em português. */
    static String decodificar(byte[] conteudo) {
        try {
            return StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(conteudo))
                    .toString();
        } catch (CharacterCodingException naoEhUtf8) {
            return new String(conteudo, Charset.forName("windows-1252"));
        }
    }

    static String cabecalhosEsperados() {
        return Arrays.stream(Coluna.values()).map(coluna -> coluna.rotulo).collect(Collectors.joining(";"));
    }
}
