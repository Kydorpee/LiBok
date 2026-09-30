package br.com.libok;

import br.com.libok.acervo.ExemplarForm;
import br.com.libok.acervo.LivroForm;
import br.com.libok.acervo.LivroService;
import br.com.libok.leitores.LeitorForm;
import br.com.libok.leitores.LeitorService;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Arrays;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;

/** Sobe o LiBok com um banco SQLite próprio, numa pasta temporária, e limpa os dados entre os testes. */
@SpringBootTest(properties = "libok.abrir-navegador=false")
@Import(TesteIntegracao.RelogioDeTeste.class)
public abstract class TesteIntegracao {

    public static final LocalDate HOJE = LocalDate.of(2026, 9, 30);
    private static final Path PASTA;

    static {
        try {
            PASTA = Files.createTempDirectory("libok-teste-");
        } catch (IOException erro) {
            throw new IllegalStateException(erro);
        }
        // Precisa existir antes do Spring configurar o log (libok.log fica na pasta de dados).
        System.setProperty("libok.pasta-dados", PASTA.toString().replace('\\', '/'));
    }

    @TestConfiguration
    static class RelogioDeTeste {
        @Bean
        @Primary
        RelogioAjustavel relogioAjustavel() {
            return new RelogioAjustavel(HOJE);
        }
    }

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected RelogioAjustavel relogio;

    @Autowired
    protected LivroService livroService;

    @Autowired
    protected LeitorService leitorService;

    protected Path pastaDados() {
        return PASTA;
    }

    @BeforeEach
    void limparBanco() {
        relogio.definir(HOJE);
        for (String tabela : new String[] {"emprestimo", "exemplar", "livro", "categoria", "leitor", "importacao"}) {
            jdbc.update("DELETE FROM " + tabela);
        }
        jdbc.update("UPDATE configuracao SET prazo_emprestimo_dias = 14, limite_emprestimos = 3, bloquear_com_atraso = 1");
    }

    protected static LivroForm livro(String titulo, String categoria, String... codigos) {
        LivroForm form = new LivroForm();
        form.setTitulo(titulo);
        form.setAutor("Autor de " + titulo);
        form.setCategoria(categoria);
        form.setAssunto("Assunto");
        form.setExemplares(Arrays.stream(codigos).map(codigo -> new ExemplarForm(null, codigo)).toList());
        return form;
    }

    protected Long cadastrarLivro(String titulo, String categoria, String... codigos) {
        return livroService.salvar(null, livro(titulo, categoria, codigos));
    }

    protected Long cadastrarLeitor(String nome) {
        LeitorForm form = new LeitorForm();
        form.setNome(nome);
        return leitorService.salvar(null, form);
    }
}
