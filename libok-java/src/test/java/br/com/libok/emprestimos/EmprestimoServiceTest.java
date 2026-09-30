package br.com.libok.emprestimos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.libok.TesteIntegracao;
import br.com.libok.acervo.ExemplarRepository;
import br.com.libok.acervo.SituacaoExemplar;
import br.com.libok.comum.RegraNegocioException;
import br.com.libok.painel.PainelDados;
import br.com.libok.painel.PainelService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class EmprestimoServiceTest extends TesteIntegracao {

    @Autowired
    EmprestimoService emprestimos;

    @Autowired
    ExemplarRepository exemplares;

    @Autowired
    PainelService painel;

    @Test
    void emprestaComPrazoPadraoEMarcaExemplar() {
        cadastrarLivro("Dom Casmurro", "Romance", "R-1");
        Long leitor = cadastrarLeitor("Ana Souza");

        Emprestimo emprestimo = emprestar(leitor, " r-1 ");

        assertThat(emprestimo.getDataEmprestimo()).isEqualTo(HOJE);
        assertThat(emprestimo.getDataPrevista()).isEqualTo(HOJE.plusDays(14));
        assertThat(situacao("R-1")).isEqualTo(SituacaoExemplar.EMPRESTADO);
    }

    @Test
    void naoEmprestaExemplarJaEmprestadoInexistenteOuParaLeitorInativo() {
        cadastrarLivro("Livro", "Romance", "R-1");
        Long ana = cadastrarLeitor("Ana");
        Long bruno = cadastrarLeitor("Bruno");
        emprestar(ana, "R-1");

        assertThatThrownBy(() -> emprestar(bruno, "R-1")).hasMessageContaining("já está emprestado para Ana");
        assertThatThrownBy(() -> emprestar(bruno, "XYZ")).hasMessageContaining("Nenhum exemplar");

        // Quem tem histórico é inativado ao excluir, e leitor inativo não pega livros.
        emprestimos.devolverPorCodigo("R-1");
        assertThat(leitorService.excluir(ana)).contains("inativado");
        assertThatThrownBy(() -> emprestar(ana, "R-1"))
                .isInstanceOf(RegraNegocioException.class)
                .hasMessageContaining("inativo");
    }

    @Test
    void respeitaLimiteDeLivrosPorLeitor() {
        cadastrarLivro("Livro", "Romance", "A", "B", "C", "D");
        Long leitor = cadastrarLeitor("Ana");
        emprestar(leitor, "A");
        emprestar(leitor, "B");
        emprestar(leitor, "C");

        assertThatThrownBy(() -> emprestar(leitor, "D")).hasMessageContaining("limite configurado é 3");
    }

    @Test
    void bloqueiaLeitorComAtrasoAteDevolver() {
        cadastrarLivro("Livro", "Romance", "A", "B");
        Long leitor = cadastrarLeitor("Ana");
        Emprestimo primeiro = emprestar(leitor, "A");

        relogio.avancarDias(20);
        assertThat(emprestimos.totalAtrasados()).isEqualTo(1);
        assertThatThrownBy(() -> emprestar(leitor, "B")).hasMessageContaining("em atraso");

        Emprestimo devolvido = emprestimos.devolver(primeiro.getId());
        assertThat(devolvido.diasAtraso(devolvido.getDataDevolucao())).isEqualTo(6);
        assertThat(situacao("A")).isEqualTo(SituacaoExemplar.DISPONIVEL);
        emprestar(leitor, "B");
    }

    @Test
    void renovaAPartirDeHojeQuandoVencido() {
        cadastrarLivro("Livro", "Romance", "A");
        Emprestimo emprestimo = emprestar(cadastrarLeitor("Ana"), "A");

        Emprestimo renovado = emprestimos.renovar(emprestimo.getId());
        assertThat(renovado.getDataPrevista()).isEqualTo(HOJE.plusDays(28));

        relogio.avancarDias(40);
        renovado = emprestimos.renovar(emprestimo.getId());
        assertThat(renovado.getDataPrevista()).isEqualTo(HOJE.plusDays(40 + 14));
        assertThat(renovado.getRenovacoes()).isEqualTo(2);
    }

    @Test
    void devolucaoRapidaPeloCodigo() {
        cadastrarLivro("Livro", "Romance", "A");
        emprestar(cadastrarLeitor("Ana"), "A");

        emprestimos.devolverPorCodigo("a");

        assertThat(situacao("A")).isEqualTo(SituacaoExemplar.DISPONIVEL);
        assertThatThrownBy(() -> emprestimos.devolverPorCodigo("A")).hasMessageContaining("não está emprestado");
    }

    @Test
    void painelContaEmprestimosLeitoresECategorias() {
        cadastrarLivro("Livro A", "Romance", "A1", "A2");
        cadastrarLivro("Livro B", "Infantil", "B1");
        Long ana = cadastrarLeitor("Ana");
        Long bruno = cadastrarLeitor("Bruno");
        emprestar(ana, "A1");
        emprestar(bruno, "A2");
        emprestar(ana, "B1");

        PainelDados dados = painel.dados(HOJE.minusDays(29), HOJE);

        assertThat(dados.emprestimos().valor()).isEqualTo(3);
        assertThat(dados.leitoresAtivos().valor()).isEqualTo(2);
        assertThat(dados.novosLeitores().valor()).isEqualTo(2);
        assertThat(dados.maisEmprestados().getFirst().nome()).isEqualTo("Livro A");
        assertThat(dados.topLeitores().getFirst().nome()).isEqualTo("Ana");
        assertThat(dados.categorias()).extracting(PainelDados.FatiaCategoria::nome).containsExactly("Romance", "Infantil");
        assertThat(dados.acervo().emprestados()).isEqualTo(3);
        assertThat(dados.tendencia().valores()).hasSize(30).last().isEqualTo(3L);
    }

    private SituacaoExemplar situacao(String codigo) {
        return exemplares.findByCodigoNormalizado(codigo).orElseThrow().getSituacao();
    }

    private Emprestimo emprestar(Long leitor, String codigo) {
        EmprestimoForm form = new EmprestimoForm();
        form.setLeitorId(leitor);
        form.setCodigoExemplar(codigo);
        return emprestimos.emprestar(form);
    }
}
