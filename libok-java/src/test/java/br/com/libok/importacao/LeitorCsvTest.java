package br.com.libok.importacao;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;

class LeitorCsvTest {

    private final LeitorCsv leitor = new LeitorCsv();

    @Test
    void leArquivoExportadoPeloLibokAntigo() {
        String csv = "﻿Nome do livro;Autor;Categoria;Assunto;Quantidade;Codigos de registro\r\n"
                + "Dom Casmurro;Machado de Assis;Romance;Literatura;2;ROM-1, ROM-2\r\n"
                + "\"Livro; com ponto e vírgula\";Autora;Infantil;Fábula;1;INF-1\r\n";

        LeituraArquivo leitura = leitor.ler(csv.getBytes(StandardCharsets.UTF_8));

        assertThat(leitura.erros()).isEmpty();
        assertThat(leitura.linhas()).hasSize(2);
        LinhaImportacao primeira = leitura.linhas().getFirst();
        assertThat(primeira.titulo()).isEqualTo("Dom Casmurro");
        assertThat(primeira.codigos()).containsExactly("ROM-1", "ROM-2");
        assertThat(primeira.linha()).isEqualTo(2);
        assertThat(leitura.linhas().get(1).titulo()).isEqualTo("Livro; com ponto e vírgula");
    }

    @Test
    void aceitaArquivoDoExcelEmWindows1252ComCabecalhosVariados() {
        String csv = "Título;AUTOR;Gênero;Assunto;Códigos;Ano\nMemórias Póstumas;Machado;Romance;Clássico;M-1|M-2;1881\n";

        LeituraArquivo leitura = leitor.ler(csv.getBytes(Charset.forName("windows-1252")));

        assertThat(leitura.erros()).isEmpty();
        LinhaImportacao linha = leitura.linhas().getFirst();
        assertThat(linha.titulo()).isEqualTo("Memórias Póstumas");
        assertThat(linha.codigos()).containsExactly("M-1", "M-2");
        assertThat(linha.anoPublicacao()).isEqualTo(1881);
    }

    @Test
    void aceitaVirgulaComoSeparador() {
        String csv = "titulo,autor,categoria,assunto,codigos\nLivro,Autor,Romance,Assunto,\"A-1, A-2\"\n";

        LeituraArquivo leitura = leitor.ler(csv.getBytes(StandardCharsets.UTF_8));

        assertThat(leitura.linhas().getFirst().codigos()).containsExactly("A-1", "A-2");
    }

    @Test
    void apontaColunasFaltandoELinhasInvalidas() {
        LeituraArquivo semColunas = leitor.ler("Nome;Autor\nX;Y\n".getBytes(StandardCharsets.UTF_8));
        assertThat(semColunas.erros()).singleElement().asString().contains("Categoria", "Assunto", "Codigos de registro");

        String csv = "Nome do livro;Autor;Categoria;Assunto;Quantidade;Codigos de registro\n"
                + "Livro 1;Autor;Romance;;1;A\n"
                + "Livro 2;Autor;Romance;Assunto;3;A, B\n"
                + ";;;;;\n"
                + "Livro 3;Autor;Romance;Assunto;dois;A\n";
        LeituraArquivo leitura = leitor.ler(csv.getBytes(StandardCharsets.UTF_8));

        assertThat(leitura.linhas()).isEmpty();
        assertThat(leitura.erros()).containsExactly(
                "Linha 0002: campos vazios (Assunto).",
                "Linha 0003: a quantidade (3) não corresponde aos 2 código(s).",
                "Linha 0005: quantidade inválida (dois).");
    }
}
