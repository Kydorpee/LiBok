package br.com.libok.leitores;

import br.com.libok.comum.RecursoNaoEncontradoException;
import br.com.libok.comum.RegraNegocioException;
import br.com.libok.comum.Textos;
import br.com.libok.emprestimos.Emprestimo;
import br.com.libok.emprestimos.EmprestimoRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LeitorService {

    private static final int ITENS_POR_PAGINA = 30;

    private final LeitorRepository leitores;
    private final EmprestimoRepository emprestimos;
    private final Clock relogio;

    public LeitorService(LeitorRepository leitores, EmprestimoRepository emprestimos, Clock relogio) {
        this.leitores = leitores;
        this.emprestimos = emprestimos;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public Page<Leitor> buscar(String busca, boolean incluirInativos, int pagina) {
        String normalizada = Textos.normalizar(busca);
        return leitores.buscar(normalizada.isEmpty() ? null : normalizada, incluirInativos,
                PageRequest.of(Math.max(0, pagina), ITENS_POR_PAGINA));
    }

    @Transactional(readOnly = true)
    public List<Leitor> ativos() {
        return leitores.findByAtivoTrueOrderByNomeNormalizadoAsc();
    }

    @Transactional(readOnly = true)
    public Leitor obter(Long id) {
        return leitores.findById(id).orElseThrow(() -> new RecursoNaoEncontradoException("Leitor não encontrado."));
    }

    @Transactional(readOnly = true)
    public LeitorDetalhe detalhar(Long id) {
        Leitor leitor = obter(id);
        LocalDate hoje = LocalDate.now(relogio);
        List<Emprestimo> historico = emprestimos.findPorLeitor(id);
        List<Emprestimo> ativos = historico.stream().filter(Emprestimo::isAtivo).toList();
        List<Emprestimo> devolvidos = historico.stream().filter(emprestimo -> !emprestimo.isAtivo()).toList();
        long atrasados = ativos.stream().filter(emprestimo -> emprestimo.isAtrasado(hoje)).count();
        return new LeitorDetalhe(leitor, ativos, devolvidos, historico.size(), atrasados);
    }

    @Transactional
    public Long salvar(Long id, LeitorForm form) {
        String matricula = Textos.limpar(form.getMatricula());
        if (matricula != null) {
            leitores.findByMatriculaIgnoreCase(matricula)
                    .filter(existente -> !existente.getId().equals(id))
                    .ifPresent(existente -> {
                        throw new RegraNegocioException("A matrícula " + matricula + " já pertence a " + existente.getNome() + ".");
                    });
        }
        Leitor leitor = id == null ? new Leitor(LocalDateTime.now(relogio)) : obter(id);
        leitor.preencher(form);
        return leitores.save(leitor).getId();
    }

    /**
     * Exclui o leitor. Quem já pegou livros é apenas inativado, para não apagar o histórico.
     * Devolve a mensagem para o usuário.
     */
    @Transactional
    public String excluir(Long id) {
        Leitor leitor = obter(id);
        if (emprestimos.countByLeitorIdAndDataDevolucaoIsNull(id) > 0) {
            throw new RegraNegocioException(leitor.getNome() + " tem livros emprestados. Registre as devoluções antes.");
        }
        if (emprestimos.existsByLeitorId(id)) {
            leitor.inativar();
            return leitor.getNome() + " foi inativado(a). O histórico de empréstimos foi mantido.";
        }
        leitores.delete(leitor);
        return leitor.getNome() + " foi excluído(a).";
    }

    @Transactional
    public void reativar(Long id) {
        obter(id).reativar();
    }
}
