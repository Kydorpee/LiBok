package br.com.libok.importacao;

import static org.assertj.core.api.Assertions.assertThat;

import br.com.libok.TesteIntegracao;
import br.com.libok.acervo.LivroRepository;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;

class ImportacaoServiceTest extends TesteIntegracao {

    @Autowired
    ImportacaoService importacoes;

    @Autowired
    LeitorCsv leitorCsv;

    @Autowired
    LeitorBancoLegado leitorLegado;

    @Autowired
    ExportacaoService exportacao;

    @Autowired
    LivroRepository livros;

    @Test
    void previaSeparaValidosDuplicadosEErros() {
        cadastrarLivro("Já Cadastrado", "Romance", "OLD-1");
        String csv = "Nome do livro;Autor;Categoria;Assunto;Codigos de registro\n"
                + "Novo Livro;Autor;Romance;Assunto;N-1, N-2\n"
                + "ja cadastrado;Autor;Romance;Assunto;X-1\n"
                + "Código Repetido;Autor;Romance;Assunto;old-1\n"
                + "Novo livro;Autor;Romance;Assunto;Y-1\n"
                + "Outro;Autor;Romance;Assunto;N-2\n";

        AnaliseImportacao analise = importacoes.analisar(leitorCsv.ler(csv.getBytes(StandardCharsets.UTF_8)));

        assertThat(analise.totalValidos()).isEqualTo(1);
        assertThat(analise.totalDuplicados()).isEqualTo(2);
        assertThat(analise.totalErros()).isEqualTo(2);
        assertThat(livros.count()).isEqualTo(1);
    }

    @Test
    void importaERegistraHistoricoComLog() {
        String csv = "Nome do livro;Autor;Categoria;Assunto;Codigos de registro\n"
                + "Livro A;Autor;Romance;Assunto;A-1\n"
                + "Livro B;Autor;Infantil;Assunto;B-1, B-2\n"
                + "Livro C;;Infantil;Assunto;C-1\n";
        LeituraArquivo leitura = leitorCsv.ler(csv.getBytes(StandardCharsets.UTF_8));

        Importacao resultado = importacoes.importar(new ImportacaoPendente("acervo.csv", "CSV", leitura));

        assertThat(resultado.getImportados()).isEqualTo(2);
        assertThat(resultado.getComErro()).isEqualTo(1);
        assertThat(resultado.getLog()).startsWith("2 livro(s) importado(s)").contains("Linha 0004");
        assertThat(importacoes.recentes()).hasSize(1);
        assertThat(livros.count()).isEqualTo(2);
    }

    @Test
    void exportacaoPodeSerImportadaDeVolta() {
        cadastrarLivro("Dom Casmurro", "Romance", "R-1", "R-2");
        java.io.StringWriter saida = new java.io.StringWriter();
        exportacao.acervo(saida);
        String conteudo = saida.toString();
        assertThat(conteudo).startsWith("﻿Nome do livro;Autor;Categoria;Assunto;Quantidade;Codigos de registro");

        jdbc.update("DELETE FROM exemplar");
        jdbc.update("DELETE FROM livro");
        Importacao resultado = importacoes.importar(new ImportacaoPendente("volta.csv", "CSV",
                leitorCsv.ler(conteudo.getBytes(StandardCharsets.UTF_8))));

        assertThat(resultado.getImportados()).isEqualTo(1);
        assertThat(livroService.detalhar(livros.findAll().getFirst().getId()).livro().getQuantidade()).isEqualTo(2);
    }

    @Test
    void importaBancoDoLibokAntigo(@TempDir Path pasta) throws Exception {
        Path antigo = pasta.resolve("libok.db");
        try (Connection conexao = DriverManager.getConnection("jdbc:sqlite:" + antigo);
             Statement comando = conexao.createStatement()) {
            comando.execute("""
                    CREATE TABLE books (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, author TEXT NOT NULL,
                    category TEXT NOT NULL, subject TEXT NOT NULL, quantity INTEGER NOT NULL, registration_codes TEXT NOT NULL)""");
            comando.execute("INSERT INTO books VALUES (1, 'Vidas Secas', 'Graciliano', 'Romance', 'Seca', 2, 'V1\nV2')");
            comando.execute("INSERT INTO books VALUES (2, 'Quebrado', 'Autor', 'Romance', 'X', 3, 'Q1')");
        }

        LeituraArquivo leitura = leitorLegado.ler(antigo);
        Importacao resultado = importacoes.importar(new ImportacaoPendente("libok.db", "LiBok antigo", leitura));

        assertThat(resultado.getImportados()).isEqualTo(1);
        assertThat(resultado.getComErro()).isEqualTo(1);
        assertThat(livros.findByTituloNormalizado("vidas secas")).isPresent();
    }

    @Test
    void recusaArquivoQueNaoEhBanco(@TempDir Path pasta) throws Exception {
        Path falso = Files.writeString(pasta.resolve("falso.db"), "não sou um banco");
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> leitorLegado.ler(falso))
                .hasMessageContaining("não é um banco");
    }
}
