package br.com.libok.importacao;

import br.com.libok.acervo.ExemplarRepository;
import br.com.libok.acervo.LivroForm;
import br.com.libok.acervo.LivroRepository;
import br.com.libok.acervo.LivroService;
import br.com.libok.comum.RegraNegocioException;
import br.com.libok.comum.Textos;
import br.com.libok.importacao.AnaliseImportacao.Item;
import br.com.libok.importacao.AnaliseImportacao.Situacao;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ImportacaoService {

    private static final Pattern CARACTERES_PROIBIDOS = Pattern.compile("[,;|]");

    private final LivroService livroService;
    private final LivroRepository livros;
    private final ExemplarRepository exemplares;
    private final ImportacaoRepository historico;
    private final Validator validador;
    private final Clock relogio;

    public ImportacaoService(LivroService livroService, LivroRepository livros, ExemplarRepository exemplares,
                             ImportacaoRepository historico, Validator validador, Clock relogio) {
        this.livroService = livroService;
        this.livros = livros;
        this.exemplares = exemplares;
        this.historico = historico;
        this.validador = validador;
        this.relogio = relogio;
    }

    /** Confere cada linha contra o acervo atual e contra as linhas anteriores do mesmo arquivo. */
    @Transactional(readOnly = true)
    public AnaliseImportacao analisar(LeituraArquivo leitura) {
        Set<String> titulos = new HashSet<>(livros.findTodosTitulosNormalizados());
        Set<String> codigos = new HashSet<>(exemplares.findTodosCodigosNormalizados());
        List<Item> itens = new ArrayList<>();

        for (LinhaImportacao linha : leitura.linhas()) {
            String titulo = Textos.normalizar(linha.titulo());
            if (titulos.contains(titulo)) {
                itens.add(new Item(linha, Situacao.DUPLICADO, "Já existe um livro com esse título."));
                continue;
            }
            String erro = validar(linha, codigos);
            if (erro != null) {
                itens.add(new Item(linha, Situacao.ERRO, erro));
                continue;
            }
            titulos.add(titulo);
            linha.codigos().forEach(codigo -> codigos.add(Textos.normalizarCodigo(codigo)));
            itens.add(new Item(linha, Situacao.VALIDO, linha.codigos().size() + " exemplar(es)."));
        }
        return new AnaliseImportacao(itens, leitura.erros());
    }

    /** Grava as linhas válidas (cada livro em sua própria transação) e registra o histórico. */
    public Importacao importar(ImportacaoPendente pendente) {
        AnaliseImportacao analise = analisar(pendente.leitura());
        List<String> log = new ArrayList<>(analise.errosDeFormato());
        int importados = 0;
        int comErro = analise.errosDeFormato().size();
        int ignorados = 0;

        for (Item item : analise.itens()) {
            String prefixo = rotuloLinha(pendente.origem(), item.linha()) + " — " + item.linha().titulo() + ": ";
            switch (item.situacao()) {
                case DUPLICADO -> {
                    ignorados++;
                    log.add(prefixo + "ignorado, " + item.mensagem().toLowerCase());
                }
                case ERRO -> {
                    comErro++;
                    log.add(prefixo + item.mensagem());
                }
                case VALIDO -> {
                    try {
                        livroService.salvar(null, item.linha().paraFormulario());
                        importados++;
                    } catch (RegraNegocioException erro) {
                        comErro++;
                        log.add(prefixo + erro.getMessage());
                    }
                }
            }
        }
        log.sort(Comparator.naturalOrder());
        log.addFirst(importados + " livro(s) importado(s), " + ignorados + " duplicado(s) ignorado(s), "
                + comErro + " com erro.");
        Importacao registro = new Importacao(pendente.nomeArquivo(), pendente.origem(), LocalDateTime.now(relogio),
                importados, ignorados, comErro, String.join("\n", log));
        return historico.save(registro);
    }

    @Transactional(readOnly = true)
    public List<Importacao> recentes() {
        return historico.findTop10ByOrderByRealizadaEmDescIdDesc();
    }

    @Transactional(readOnly = true)
    public Importacao obter(Long id) {
        return historico.findById(id).orElseThrow(() -> new RegraNegocioException("Importação não encontrada."));
    }

    private String validar(LinhaImportacao linha, Set<String> codigosExistentes) {
        LivroForm form = linha.paraFormulario();
        Set<ConstraintViolation<LivroForm>> violacoes = validador.validate(form);
        if (!violacoes.isEmpty()) {
            return violacoes.iterator().next().getMessage();
        }
        if (linha.codigos().isEmpty()) {
            return "Nenhum código de registro informado.";
        }
        Set<String> daLinha = new HashSet<>();
        for (String codigo : linha.codigos()) {
            if (codigo.length() > 50) {
                return "O código \"" + codigo + "\" passa de 50 caracteres.";
            }
            if (CARACTERES_PROIBIDOS.matcher(codigo).find()) {
                return "O código \"" + codigo + "\" tem caractere não permitido.";
            }
            String normalizado = Textos.normalizarCodigo(codigo);
            if (!daLinha.add(normalizado)) {
                return "O código \"" + codigo + "\" aparece duas vezes.";
            }
            if (codigosExistentes.contains(normalizado)) {
                return "O código \"" + codigo + "\" já está em uso por outro livro.";
            }
        }
        return null;
    }

    private static String rotuloLinha(String origem, LinhaImportacao linha) {
        return (origem.startsWith("CSV") ? "Linha " : "Registro ") + String.format("%04d", linha.linha());
    }
}
