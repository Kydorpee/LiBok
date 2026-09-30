package br.com.libok.acervo;

import br.com.libok.comum.RecursoNaoEncontradoException;
import br.com.libok.comum.RegraNegocioException;
import br.com.libok.comum.Textos;
import br.com.libok.emprestimos.Emprestimo;
import br.com.libok.emprestimos.EmprestimoRepository;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.hibernate.Hibernate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LivroService {

    public static final int ITENS_POR_PAGINA = 24;

    /** Vírgula, ponto e vírgula e barra vertical separam códigos no CSV e não podem fazer parte deles. */
    private static final Pattern CARACTERES_PROIBIDOS = Pattern.compile("[,;|]");

    private final LivroRepository livros;
    private final ExemplarRepository exemplares;
    private final EmprestimoRepository emprestimos;
    private final CategoriaService categorias;
    private final Clock relogio;

    public LivroService(LivroRepository livros, ExemplarRepository exemplares, EmprestimoRepository emprestimos,
                        CategoriaService categorias, Clock relogio) {
        this.livros = livros;
        this.exemplares = exemplares;
        this.emprestimos = emprestimos;
        this.categorias = categorias;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public Page<LivroResumo> buscar(FiltroAcervo filtro) {
        String busca = Textos.normalizar(filtro.getBusca());
        PageRequest pagina = PageRequest.of(filtro.getPagina(), ITENS_POR_PAGINA, filtro.ordenacao());
        return livros.buscar(busca.isEmpty() ? null : busca, filtro.getCategoria(), filtro.isDisponiveis(), pagina)
                .map(LivroResumo::de);
    }

    @Transactional(readOnly = true)
    public LivroDetalhe detalhar(Long id) {
        Livro livro = obter(id);
        Map<Long, Emprestimo> ativosPorExemplar = new HashMap<>();
        List<Emprestimo> historico = emprestimos.findPorLivro(id);
        historico.stream()
                .filter(Emprestimo::isAtivo)
                .forEach(emprestimo -> ativosPorExemplar.put(emprestimo.getExemplar().getId(), emprestimo));
        List<LivroDetalhe.LinhaExemplar> linhas = livro.getExemplares().stream()
                .map(exemplar -> new LivroDetalhe.LinhaExemplar(exemplar, ativosPorExemplar.get(exemplar.getId())))
                .toList();
        return new LivroDetalhe(livro, linhas, historico);
    }

    @Transactional(readOnly = true)
    public LivroForm formulario(Long id) {
        return LivroForm.de(obter(id));
    }

    @Transactional(readOnly = true)
    public String titulo(Long id) {
        return obter(id).getTitulo();
    }

    /** Cadastra (id nulo) ou atualiza um livro e seus exemplares. Devolve o id do livro. */
    @Transactional
    public Long salvar(Long id, LivroForm form) {
        List<ExemplarForm> linhas = validarCodigos(form.getExemplares());
        String tituloNormalizado = Textos.normalizar(form.getTitulo());
        livros.findByTituloNormalizado(tituloNormalizado)
                .filter(existente -> !existente.getId().equals(id))
                .ifPresent(existente -> {
                    throw new RegraNegocioException("Já existe um livro com o título \"" + existente.getTitulo() + "\".");
                });

        LocalDateTime agora = LocalDateTime.now(relogio);
        Livro livro = id == null ? new Livro(agora) : obter(id);
        verificarCodigosDeOutrosLivros(linhas, id);

        Categoria categoria = categorias.obterOuCriar(form.getCategoria());
        livro.preencher(form.getTitulo(), form.getAutor(), categoria, form.getAssunto(), form.getIsbn(),
                form.getAnoPublicacao(), form.getDescricao(), agora);
        sincronizarExemplares(livro, linhas);
        livro.atualizarTextoBusca();
        return livros.save(livro).getId();
    }

    @Transactional
    public String excluir(Long id) {
        Livro livro = obter(id);
        if (emprestimos.existsByExemplarLivroIdAndDataDevolucaoIsNull(id)) {
            throw new RegraNegocioException(
                    "\"" + livro.getTitulo() + "\" tem exemplares emprestados. Registre as devoluções antes de excluir.");
        }
        livros.delete(livro);
        return livro.getTitulo();
    }

    /** Marca um exemplar como baixado (perdido, danificado ou descartado), preservando o histórico. */
    @Transactional
    public Long baixarExemplar(Long exemplarId) {
        Exemplar exemplar = obterExemplar(exemplarId);
        if (exemplar.getSituacao() == SituacaoExemplar.EMPRESTADO) {
            throw new RegraNegocioException("O exemplar " + exemplar.getCodigo() + " está emprestado. Registre a devolução antes.");
        }
        exemplar.baixar();
        return exemplar.getLivro().getId();
    }

    @Transactional
    public Long reativarExemplar(Long exemplarId) {
        Exemplar exemplar = obterExemplar(exemplarId);
        if (exemplar.isBaixado()) {
            exemplar.reativar();
        }
        return exemplar.getLivro().getId();
    }

    private Livro obter(Long id) {
        Livro livro = livros.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Livro não encontrado."));
        Hibernate.initialize(livro.getExemplares());
        return livro;
    }

    private Exemplar obterExemplar(Long id) {
        return exemplares.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException("Exemplar não encontrado."));
    }

    private List<ExemplarForm> validarCodigos(List<ExemplarForm> informados) {
        List<ExemplarForm> linhas = informados == null ? List.of() : informados.stream()
                .filter(linha -> linha != null && (linha.getId() != null || Textos.limpar(linha.getCodigo()) != null))
                .toList();
        if (linhas.isEmpty()) {
            throw new RegraNegocioException("Informe o código de registro de pelo menos um exemplar.");
        }
        Set<String> vistos = new HashSet<>();
        for (ExemplarForm linha : linhas) {
            String codigo = Textos.limpar(linha.getCodigo());
            if (codigo == null) {
                throw new RegraNegocioException("Informe o código de cada exemplar.");
            }
            if (codigo.length() > 50) {
                throw new RegraNegocioException("O código \"" + codigo + "\" passa de 50 caracteres.");
            }
            if (CARACTERES_PROIBIDOS.matcher(codigo).find()) {
                throw new RegraNegocioException("O código \"" + codigo + "\" não pode conter vírgula, ponto e vírgula ou |.");
            }
            if (!vistos.add(Textos.normalizarCodigo(codigo))) {
                throw new RegraNegocioException("O código \"" + codigo + "\" foi informado mais de uma vez.");
            }
        }
        return linhas;
    }

    private void verificarCodigosDeOutrosLivros(List<ExemplarForm> linhas, Long livroId) {
        Set<String> codigos = linhas.stream()
                .map(linha -> Textos.normalizarCodigo(linha.getCodigo()))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        for (Exemplar existente : exemplares.findByCodigoNormalizadoIn(codigos)) {
            if (!existente.getLivro().getId().equals(livroId)) {
                throw new RegraNegocioException("O código \"" + existente.getCodigo()
                        + "\" já pertence ao livro \"" + existente.getLivro().getTitulo() + "\".");
            }
        }
    }

    private void sincronizarExemplares(Livro livro, List<ExemplarForm> linhas) {
        Map<Long, Exemplar> existentes = livro.getExemplares().stream()
                .filter(exemplar -> exemplar.getId() != null)
                .collect(Collectors.toMap(Exemplar::getId, Function.identity()));
        Set<Long> mantidos = new HashSet<>();
        List<ExemplarForm> novos = new ArrayList<>();

        for (ExemplarForm linha : linhas) {
            if (linha.getId() == null) {
                novos.add(linha);
                continue;
            }
            Exemplar exemplar = existentes.get(linha.getId());
            if (exemplar == null) {
                throw new RegraNegocioException("Um dos exemplares não pertence a este livro. Recarregue a página.");
            }
            exemplar.alterarCodigo(linha.getCodigo());
            mantidos.add(exemplar.getId());
        }

        for (ExemplarForm linha : novos) {
            // Um código novo igual ao de um exemplar removido ou baixado deste livro reaproveita o mesmo registro.
            String codigo = Textos.normalizarCodigo(linha.getCodigo());
            Exemplar reaproveitado = existentes.values().stream()
                    .filter(exemplar -> !mantidos.contains(exemplar.getId()))
                    .filter(exemplar -> exemplar.getCodigoNormalizado().equals(codigo))
                    .findFirst()
                    .orElse(null);
            if (reaproveitado != null) {
                reaproveitado.alterarCodigo(linha.getCodigo());
                if (reaproveitado.isBaixado()) {
                    reaproveitado.reativar();
                }
                mantidos.add(reaproveitado.getId());
            } else {
                livro.adicionarExemplar(linha.getCodigo());
            }
        }

        for (Exemplar exemplar : existentes.values()) {
            if (mantidos.contains(exemplar.getId()) || exemplar.isBaixado()) {
                continue;
            }
            if (exemplar.getSituacao() == SituacaoExemplar.EMPRESTADO) {
                throw new RegraNegocioException("O exemplar " + exemplar.getCodigo()
                        + " está emprestado e não pode ser removido. Registre a devolução antes.");
            }
            if (emprestimos.existsByExemplarId(exemplar.getId())) {
                exemplar.baixar();
            } else {
                livro.removerExemplar(exemplar);
            }
        }
    }
}
