package br.com.libok.acervo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.libok.TesteIntegracao;
import br.com.libok.comum.RegraNegocioException;
import br.com.libok.emprestimos.EmprestimoForm;
import br.com.libok.emprestimos.EmprestimoService;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class LivroServiceTest extends TesteIntegracao {

    @Autowired
    ExemplarRepository exemplares;

    @Autowired
    EmprestimoService emprestimos;

    @Autowired
    CategoriaRepository categorias;

    @Test
    void cadastraLivroComExemplares() {
        Long id = cadastrarLivro("Dom Casmurro", "Romance", "ROM-001", "ROM-002");

        LivroDetalhe detalhe = livroService.detalhar(id);
        assertThat(detalhe.livro().getTitulo()).isEqualTo("Dom Casmurro");
        assertThat(detalhe.livro().getQuantidade()).isEqualTo(2);
        assertThat(detalhe.livro().getDisponiveis()).isEqualTo(2);
    }

    @Test
    void buscaIgnoraAcentosEMaiusculasEEncontraPorCodigo() {
        cadastrarLivro("Ficção Científica Hoje", "Ficção", "FIC-001");
        cadastrarLivro("Outro livro", "Romance", "ROM-9");

        assertThat(buscar("ficcao")).extracting(LivroResumo::titulo).containsExactly("Ficção Científica Hoje");
        assertThat(buscar("CIENTÍFICA")).hasSize(1);
        assertThat(buscar("rom-9")).extracting(LivroResumo::titulo).containsExactly("Outro livro");
        assertThat(buscar("inexistente")).isEmpty();
    }

    @Test
    void recusaTituloDuplicadoMesmoComAcentosEEspacosDiferentes() {
        cadastrarLivro("O Cortiço", "Romance", "A1");

        assertThatThrownBy(() -> cadastrarLivro("  o  cortico ", "Romance", "A2"))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("Já existe um livro");
    }

    @Test
    void edicaoTambemNaoPermiteTituloDuplicado() {
        cadastrarLivro("Vidas Secas", "Romance", "A1");
        Long outro = cadastrarLivro("Capitães da Areia", "Romance", "A2");

        LivroForm form = livroService.formulario(outro);
        form.setTitulo("VIDAS SECAS");

        assertThatThrownBy(() -> livroService.salvar(outro, form)).isInstanceOf(RegraNegocioException.class);
    }

    @Test
    void recusaCodigoRepetidoNoFormularioOuEmOutroLivro() {
        assertThatThrownBy(() -> cadastrarLivro("Livro A", "Romance", "X-1", "x-1 "))
                .hasMessageContaining("mais de uma vez");

        cadastrarLivro("Livro B", "Romance", "X-1");
        assertThatThrownBy(() -> cadastrarLivro("Livro C", "Romance", "x-1"))
                .hasMessageContaining("já pertence ao livro \"Livro B\"");
    }

    @Test
    void recusaCodigoComSeparadorDeCsvOuVazio() {
        assertThatThrownBy(() -> cadastrarLivro("Livro", "Romance", "A,1")).hasMessageContaining("vírgula");
        assertThatThrownBy(() -> cadastrarLivro("Livro", "Romance")).hasMessageContaining("pelo menos um exemplar");
    }

    @Test
    void reaproveitaCategoriaComGrafiaDiferente() {
        cadastrarLivro("Livro 1", "Romance", "A1");
        cadastrarLivro("Livro 2", " romance ", "A2");
        cadastrarLivro("Livro 3", "Ficção", "A3");
        cadastrarLivro("Livro 4", "ficcao", "A4");

        assertThat(categorias.findAll()).extracting(Categoria::getNome).containsExactlyInAnyOrder("Romance", "Ficção");
    }

    @Test
    void edicaoRemoveExemplarSemHistoricoEBaixaExemplarComHistorico() {
        Long id = cadastrarLivro("Sapiens", "História", "H-1", "H-2", "H-3");
        Long leitor = cadastrarLeitor("Ana");
        emprestar(leitor, "H-2");
        emprestimos.devolverPorCodigo("H-2");

        LivroForm form = livroService.formulario(id);
        List<ExemplarForm> mantidos = new ArrayList<>(form.getExemplares());
        mantidos.removeIf(exemplar -> !exemplar.getCodigo().equals("H-1"));
        mantidos.add(new ExemplarForm(null, "H-4"));
        form.setExemplares(mantidos);
        livroService.salvar(id, form);

        LivroDetalhe detalhe = livroService.detalhar(id);
        assertThat(detalhe.livro().getExemplaresAtivos()).extracting(Exemplar::getCodigo).containsExactly("H-1", "H-4");
        assertThat(exemplares.findByCodigoNormalizado("H-2")).get()
                .extracting(Exemplar::getSituacao).isEqualTo(SituacaoExemplar.BAIXADO);
        assertThat(exemplares.findByCodigoNormalizado("H-3")).isEmpty();
        assertThat(detalhe.historico()).hasSize(1);
    }

    @Test
    void naoRemoveExemplarEmprestadoNemExcluiLivroComEmprestimoAberto() {
        Long id = cadastrarLivro("1984", "Ficção", "F-1", "F-2");
        emprestar(cadastrarLeitor("Bruno"), "F-1");

        LivroForm form = livroService.formulario(id);
        form.setExemplares(new ArrayList<>(form.getExemplares().subList(1, 2)));

        assertThatThrownBy(() -> livroService.salvar(id, form)).hasMessageContaining("está emprestado");
        assertThatThrownBy(() -> livroService.excluir(id)).hasMessageContaining("emprestados");
    }

    @Test
    void codigoDeExemplarRemovidoPodeSerReincluido() {
        Long id = cadastrarLivro("Livro", "Romance", "R-1", "R-2");
        LivroForm form = livroService.formulario(id);
        form.setExemplares(new ArrayList<>(List.of(form.getExemplares().getFirst(), new ExemplarForm(null, "r-2"))));

        livroService.salvar(id, form);

        assertThat(livroService.detalhar(id).livro().getQuantidade()).isEqualTo(2);
    }

    private List<LivroResumo> buscar(String texto) {
        FiltroAcervo filtro = new FiltroAcervo();
        filtro.setBusca(texto);
        return livroService.buscar(filtro).getContent();
    }

    private void emprestar(Long leitor, String codigo) {
        EmprestimoForm form = new EmprestimoForm();
        form.setLeitorId(leitor);
        form.setCodigoExemplar(codigo);
        emprestimos.emprestar(form);
    }
}
