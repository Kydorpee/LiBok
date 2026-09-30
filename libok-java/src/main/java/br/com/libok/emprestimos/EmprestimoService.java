package br.com.libok.emprestimos;

import br.com.libok.acervo.Exemplar;
import br.com.libok.acervo.ExemplarRepository;
import br.com.libok.acervo.SituacaoExemplar;
import br.com.libok.comum.RecursoNaoEncontradoException;
import br.com.libok.comum.RegraNegocioException;
import br.com.libok.comum.Textos;
import br.com.libok.configuracao.Configuracao;
import br.com.libok.configuracao.ConfiguracaoService;
import br.com.libok.leitores.Leitor;
import br.com.libok.leitores.LeitorRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EmprestimoService {

    private final EmprestimoRepository emprestimos;
    private final ExemplarRepository exemplares;
    private final LeitorRepository leitores;
    private final ConfiguracaoService configuracoes;
    private final Clock relogio;

    public EmprestimoService(EmprestimoRepository emprestimos, ExemplarRepository exemplares,
                             LeitorRepository leitores, ConfiguracaoService configuracoes, Clock relogio) {
        this.emprestimos = emprestimos;
        this.exemplares = exemplares;
        this.leitores = leitores;
        this.configuracoes = configuracoes;
        this.relogio = relogio;
    }

    public LocalDate hoje() {
        return LocalDate.now(relogio);
    }

    @Transactional(readOnly = true)
    public LocalDate dataPrevistaPadrao() {
        return hoje().plusDays(configuracoes.atual().getPrazoEmprestimoDias());
    }

    @Transactional
    public Emprestimo emprestar(EmprestimoForm form) {
        LocalDate hoje = hoje();
        Configuracao configuracao = configuracoes.atual();

        Leitor leitor = leitores.findById(form.getLeitorId())
                .orElseThrow(() -> new RegraNegocioException("Leitor não encontrado."));
        if (!leitor.isAtivo()) {
            throw new RegraNegocioException(leitor.getNome() + " está inativo(a). Reative o cadastro para emprestar.");
        }

        Exemplar exemplar = exemplares.findByCodigoNormalizado(Textos.normalizarCodigo(form.getCodigoExemplar()))
                .orElseThrow(() -> new RegraNegocioException(
                        "Nenhum exemplar com o código \"" + Textos.limpar(form.getCodigoExemplar()) + "\"."));
        if (exemplar.getSituacao() == SituacaoExemplar.BAIXADO) {
            throw new RegraNegocioException("O exemplar " + exemplar.getCodigo() + " está baixado e não pode ser emprestado.");
        }
        if (exemplar.getSituacao() == SituacaoExemplar.EMPRESTADO) {
            String comQuem = emprestimos.findAtivoDoExemplar(exemplar.getId())
                    .map(ativo -> " para " + ativo.getLeitor().getNome())
                    .orElse("");
            throw new RegraNegocioException("O exemplar " + exemplar.getCodigo() + " já está emprestado" + comQuem + ".");
        }

        if (configuracao.isBloquearComAtraso()
                && emprestimos.existsByLeitorIdAndDataDevolucaoIsNullAndDataPrevistaBefore(leitor.getId(), hoje)) {
            throw new RegraNegocioException(leitor.getNome() + " tem livros em atraso. Registre a devolução antes de um novo empréstimo.");
        }
        long ativos = emprestimos.countByLeitorIdAndDataDevolucaoIsNull(leitor.getId());
        if (ativos >= configuracao.getLimiteEmprestimos()) {
            throw new RegraNegocioException(leitor.getNome() + " já está com " + ativos
                    + " livro(s), o limite configurado é " + configuracao.getLimiteEmprestimos() + ".");
        }

        LocalDate dataPrevista = form.getDataPrevista() != null
                ? form.getDataPrevista()
                : hoje.plusDays(configuracao.getPrazoEmprestimoDias());
        if (dataPrevista.isBefore(hoje)) {
            throw new RegraNegocioException("A data de devolução não pode ser anterior a hoje.");
        }

        exemplar.emprestar();
        String observacao = form.getObservacao() == null || form.getObservacao().isBlank() ? null : form.getObservacao().strip();
        return emprestimos.save(new Emprestimo(exemplar, leitor, hoje, dataPrevista, observacao));
    }

    @Transactional
    public Emprestimo devolver(Long id) {
        Emprestimo emprestimo = obter(id);
        if (!emprestimo.isAtivo()) {
            throw new RegraNegocioException("Este empréstimo já foi devolvido.");
        }
        emprestimo.devolver(hoje());
        emprestimo.getExemplar().devolver();
        return emprestimo;
    }

    /** Devolução pelo código do exemplar, útil com leitor de código de barras. */
    @Transactional
    public Emprestimo devolverPorCodigo(String codigo) {
        Exemplar exemplar = exemplares.findByCodigoNormalizado(Textos.normalizarCodigo(codigo))
                .orElseThrow(() -> new RegraNegocioException("Nenhum exemplar com o código \"" + Textos.limpar(codigo) + "\"."));
        Emprestimo emprestimo = emprestimos.findAtivoDoExemplar(exemplar.getId())
                .orElseThrow(() -> new RegraNegocioException("O exemplar " + exemplar.getCodigo() + " não está emprestado."));
        return devolver(emprestimo.getId());
    }

    /** Estende o prazo a partir de hoje (ou da data prevista, se ainda não venceu). */
    @Transactional
    public Emprestimo renovar(Long id) {
        Emprestimo emprestimo = obter(id);
        if (!emprestimo.isAtivo()) {
            throw new RegraNegocioException("Não é possível renovar um empréstimo já devolvido.");
        }
        LocalDate base = emprestimo.getDataPrevista().isAfter(hoje()) ? emprestimo.getDataPrevista() : hoje();
        emprestimo.renovar(base.plusDays(configuracoes.atual().getPrazoEmprestimoDias()));
        return emprestimo;
    }

    @Transactional(readOnly = true)
    public List<Emprestimo> ativos() {
        return emprestimos.findAtivos();
    }

    @Transactional(readOnly = true)
    public List<Emprestimo> atrasados() {
        return emprestimos.findAtrasados(hoje());
    }

    @Transactional(readOnly = true)
    public Page<Emprestimo> devolvidos(int pagina) {
        return emprestimos.findDevolvidos(PageRequest.of(Math.max(0, pagina), 30));
    }

    @Transactional(readOnly = true)
    public long totalAtrasados() {
        return emprestimos.countByDataDevolucaoIsNullAndDataPrevistaBefore(hoje());
    }

    @Transactional(readOnly = true)
    public List<Exemplar> exemplaresDisponiveis() {
        return exemplares.findDisponiveis();
    }

    /** Código de um exemplar disponível do livro, para já vir preenchido no formulário. */
    @Transactional(readOnly = true)
    public String primeiroCodigoDisponivel(Long livroId) {
        if (livroId == null) {
            return null;
        }
        return exemplares.findDisponiveis().stream()
                .filter(exemplar -> exemplar.getLivro().getId().equals(livroId))
                .map(Exemplar::getCodigo)
                .findFirst()
                .orElse(null);
    }

    private Emprestimo obter(Long id) {
        return emprestimos.findCompleto(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Empréstimo não encontrado."));
    }
}
