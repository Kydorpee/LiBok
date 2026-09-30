package br.com.libok.leitores;

import br.com.libok.emprestimos.Emprestimo;
import java.util.List;

public record LeitorDetalhe(
        Leitor leitor,
        List<Emprestimo> ativos,
        List<Emprestimo> devolvidos,
        long totalEmprestimos,
        long atrasados) {
}
