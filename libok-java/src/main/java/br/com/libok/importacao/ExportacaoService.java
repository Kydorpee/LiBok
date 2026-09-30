package br.com.libok.importacao;

import br.com.libok.acervo.Exemplar;
import br.com.libok.acervo.Livro;
import br.com.libok.acervo.LivroRepository;
import br.com.libok.emprestimos.Emprestimo;
import br.com.libok.emprestimos.EmprestimoRepository;
import br.com.libok.leitores.Leitor;
import br.com.libok.leitores.LeitorRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.io.Writer;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Exporta planilhas CSV com ";" e BOM UTF-8, que o Excel em português abre corretamente. */
@Service
public class ExportacaoService {

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final LivroRepository livros;
    private final LeitorRepository leitores;
    private final EmprestimoRepository emprestimos;
    private final Clock relogio;

    public ExportacaoService(LivroRepository livros, LeitorRepository leitores,
                             EmprestimoRepository emprestimos, Clock relogio) {
        this.livros = livros;
        this.leitores = leitores;
        this.emprestimos = emprestimos;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public void acervo(Writer destino) {
        escrever(destino, List.of("Nome do livro", "Autor", "Categoria", "Assunto", "Quantidade",
                "Codigos de registro", "ISBN", "Ano de publicacao", "Descricao", "Exemplares disponiveis"), impressora -> {
            for (Livro livro : livros.findTodosOrdenados()) {
                String codigos = livro.getExemplaresAtivos().stream()
                        .map(Exemplar::getCodigo)
                        .collect(Collectors.joining(", "));
                impressora.printRecord(livro.getTitulo(), livro.getAutor(), livro.getCategoria().getNome(),
                        livro.getAssunto(), livro.getQuantidade(), codigos, vazio(livro.getIsbn()),
                        livro.getAnoPublicacao() == null ? "" : livro.getAnoPublicacao(),
                        vazio(livro.getDescricao()), livro.getDisponiveis());
            }
        });
    }

    @Transactional(readOnly = true)
    public void emprestimos(Writer destino) {
        LocalDate hoje = LocalDate.now(relogio);
        escrever(destino, List.of("Leitor", "Matricula", "Livro", "Codigo do exemplar", "Data do emprestimo",
                "Devolucao prevista", "Data da devolucao", "Situacao", "Renovacoes"), impressora -> {
            for (Emprestimo emprestimo : emprestimos.findTodosCompletos()) {
                String situacao = !emprestimo.isAtivo() ? "Devolvido"
                        : emprestimo.isAtrasado(hoje) ? "Atrasado" : "Emprestado";
                impressora.printRecord(emprestimo.getLeitor().getNome(), vazio(emprestimo.getLeitor().getMatricula()),
                        emprestimo.getExemplar().getLivro().getTitulo(), emprestimo.getExemplar().getCodigo(),
                        emprestimo.getDataEmprestimo().format(DATA), emprestimo.getDataPrevista().format(DATA),
                        emprestimo.getDataDevolucao() == null ? "" : emprestimo.getDataDevolucao().format(DATA),
                        situacao, emprestimo.getRenovacoes());
            }
        });
    }

    @Transactional(readOnly = true)
    public void leitores(Writer destino) {
        escrever(destino, List.of("Nome", "Matricula", "Turma", "Telefone", "E-mail", "Situacao", "Cadastrado em"),
                impressora -> {
                    for (Leitor leitor : leitores.findAll()) {
                        impressora.printRecord(leitor.getNome(), vazio(leitor.getMatricula()), vazio(leitor.getTurma()),
                                vazio(leitor.getTelefone()), vazio(leitor.getEmail()),
                                leitor.isAtivo() ? "Ativo" : "Inativo", leitor.getCriadoEm().toLocalDate().format(DATA));
                    }
                });
    }

    private interface Conteudo {
        void escrever(CSVPrinter impressora) throws IOException;
    }

    private static void escrever(Writer destino, List<String> cabecalho, Conteudo conteudo) {
        CSVFormat formato = CSVFormat.DEFAULT.builder()
                .setDelimiter(';')
                .setRecordSeparator("\r\n")
                .setHeader(cabecalho.toArray(String[]::new))
                .get();
        try {
            destino.write('﻿');
            CSVPrinter impressora = new CSVPrinter(destino, formato);
            conteudo.escrever(impressora);
            impressora.flush();
        } catch (IOException erro) {
            throw new UncheckedIOException(erro);
        }
    }

    private static String vazio(String valor) {
        return valor == null ? "" : valor;
    }
}
