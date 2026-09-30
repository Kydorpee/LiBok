package br.com.libok.acervo;

import br.com.libok.comum.Textos;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Cada cópia física de um livro, identificada pelo seu código de registro. */
@Entity
@Table(name = "exemplar")
public class Exemplar {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "livro_id")
    private Livro livro;

    @Column(nullable = false)
    private String codigo;

    @Column(name = "codigo_normalizado", nullable = false, unique = true)
    private String codigoNormalizado;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SituacaoExemplar situacao = SituacaoExemplar.DISPONIVEL;

    protected Exemplar() {
    }

    Exemplar(Livro livro, String codigo) {
        this.livro = livro;
        alterarCodigo(codigo);
    }

    void alterarCodigo(String codigo) {
        this.codigo = Textos.limpar(codigo);
        this.codigoNormalizado = Textos.normalizarCodigo(codigo);
    }

    public void emprestar() {
        this.situacao = SituacaoExemplar.EMPRESTADO;
    }

    public void devolver() {
        if (situacao == SituacaoExemplar.EMPRESTADO) {
            this.situacao = SituacaoExemplar.DISPONIVEL;
        }
    }

    void baixar() {
        this.situacao = SituacaoExemplar.BAIXADO;
    }

    void reativar() {
        this.situacao = SituacaoExemplar.DISPONIVEL;
    }

    public boolean isDisponivel() {
        return situacao == SituacaoExemplar.DISPONIVEL;
    }

    public boolean isBaixado() {
        return situacao == SituacaoExemplar.BAIXADO;
    }

    public Long getId() {
        return id;
    }

    public Livro getLivro() {
        return livro;
    }

    public String getCodigo() {
        return codigo;
    }

    public String getCodigoNormalizado() {
        return codigoNormalizado;
    }

    public SituacaoExemplar getSituacao() {
        return situacao;
    }
}
