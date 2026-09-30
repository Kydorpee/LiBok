package br.com.libok.importacao;

import br.com.libok.comum.RegraNegocioException;
import br.com.libok.comum.Textos;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.springframework.stereotype.Component;

/** Lê o arquivo libok.db da versão anterior (Python), tabela "books". */
@Component
public class LeitorBancoLegado {

    private static final byte[] ASSINATURA_SQLITE = "SQLite format 3\0".getBytes(StandardCharsets.US_ASCII);

    public LeituraArquivo ler(Path arquivo) {
        if (!ehSqlite(arquivo)) {
            throw new RegraNegocioException("O arquivo enviado não é um banco de dados do LiBok.");
        }
        String url = "jdbc:sqlite:" + arquivo.toAbsolutePath() + "?open_mode=1";
        try (Connection conexao = DriverManager.getConnection(url);
             Statement consulta = conexao.createStatement()) {
            try (ResultSet tabelas = consulta.executeQuery(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'books'")) {
                if (!tabelas.next()) {
                    throw new RegraNegocioException("O banco enviado não tem a tabela de livros do LiBok antigo.");
                }
            }
            List<LinhaImportacao> linhas = new ArrayList<>();
            List<String> erros = new ArrayList<>();
            try (ResultSet livros = consulta.executeQuery(
                    "SELECT id, name, author, category, subject, quantity, registration_codes FROM books ORDER BY id")) {
                while (livros.next()) {
                    int id = livros.getInt("id");
                    List<String> codigos = Arrays.stream(livros.getString("registration_codes").split("\\R"))
                            .map(Textos::limpar)
                            .filter(codigo -> codigo != null)
                            .toList();
                    if (livros.getInt("quantity") != codigos.size()) {
                        erros.add(String.format("Registro %04d — %s: quantidade diferente do número de códigos.",
                                id, livros.getString("name")));
                        continue;
                    }
                    linhas.add(new LinhaImportacao(id, livros.getString("name"), livros.getString("author"),
                            livros.getString("category"), livros.getString("subject"), codigos, null, null, null));
                }
            }
            return new LeituraArquivo(linhas, erros);
        } catch (SQLException erro) {
            throw new RegraNegocioException("Não foi possível ler o banco antigo: " + erro.getMessage());
        }
    }

    private static boolean ehSqlite(Path arquivo) {
        try (InputStream entrada = Files.newInputStream(arquivo)) {
            byte[] cabecalho = entrada.readNBytes(ASSINATURA_SQLITE.length);
            return Arrays.equals(cabecalho, ASSINATURA_SQLITE);
        } catch (IOException erro) {
            return false;
        }
    }
}
