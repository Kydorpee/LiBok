package br.com.libok.emprestimos;

import br.com.libok.acervo.Exemplar;
import br.com.libok.leitores.Leitor;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

@Entity
@Table(name = "emprestimo")
public class Emprestimo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exemplar_id")
    private Exemplar exemplar;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "leitor_id")
    private Leitor leitor;

    @Column(name = "data_emprestimo", nullable = false)
    private LocalDate dataEmprestimo;

    @Column(name = "data_prevista", nullable = false)
    private LocalDate dataPrevista;

    @Column(name = "data_devolucao")
    private LocalDate dataDevolucao;

    @Column(nullable = false)
    private int renovacoes;

    private String observacao;

    protected Emprestimo() {
    }

    Emprestimo(Exemplar exemplar, Leitor leitor, LocalDate dataEmprestimo, LocalDate dataPrevista, String observacao) {
        this.exemplar = exemplar;
        this.leitor = leitor;
        this.dataEmprestimo = dataEmprestimo;
        this.dataPrevista = dataPrevista;
        this.observacao = observacao;
    }

    void devolver(LocalDate data) {
        this.dataDevolucao = data;
    }

    void renovar(LocalDate novaData) {
        this.dataPrevista = novaData;
        this.renovacoes++;
    }

    public boolean isAtivo() {
        return dataDevolucao == null;
    }

    public boolean isAtrasado(LocalDate hoje) {
        return isAtivo() && dataPrevista.isBefore(hoje);
    }

    public long diasAtraso(LocalDate hoje) {
        LocalDate referencia = isAtivo() ? hoje : dataDevolucao;
        return Math.max(0, ChronoUnit.DAYS.between(dataPrevista, referencia));
    }

    public long diasParaVencer(LocalDate hoje) {
        return ChronoUnit.DAYS.between(hoje, dataPrevista);
    }

    public boolean isDevolvidoComAtraso() {
        return dataDevolucao != null && dataDevolucao.isAfter(dataPrevista);
    }

    public Long getId() {
        return id;
    }

    public Exemplar getExemplar() {
        return exemplar;
    }

    public Leitor getLeitor() {
        return leitor;
    }

    public LocalDate getDataEmprestimo() {
        return dataEmprestimo;
    }

    public LocalDate getDataPrevista() {
        return dataPrevista;
    }

    public LocalDate getDataDevolucao() {
        return dataDevolucao;
    }

    public int getRenovacoes() {
        return renovacoes;
    }

    public String getObservacao() {
        return observacao;
    }
}
