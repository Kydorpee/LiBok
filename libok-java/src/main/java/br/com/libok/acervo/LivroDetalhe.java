package br.com.libok.acervo;

import br.com.libok.emprestimos.Emprestimo;
import java.util.List;

public record LivroDetalhe(Livro livro, List<LinhaExemplar> exemplares, List<Emprestimo> historico) {

    /** Um exemplar e, se estiver emprestado, o empréstimo em aberto. */
    public record LinhaExemplar(Exemplar exemplar, Emprestimo emprestimoAtivo) {
    }
}
