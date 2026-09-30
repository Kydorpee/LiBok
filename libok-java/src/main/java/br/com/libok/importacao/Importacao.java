package br.com.libok.importacao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

/** Histórico de importações, com o log completo de cada uma. */
@Entity
@Table(name = "importacao")
public class Importacao {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nome_arquivo", nullable = false)
    private String nomeArquivo;

    @Column(nullable = false)
    private String origem;

    @Column(name = "realizada_em", nullable = false)
    private LocalDateTime realizadaEm;

    @Column(nullable = false)
    private int importados;

    @Column(nullable = false)
    private int ignorados;

    @Column(name = "com_erro", nullable = false)
    private int comErro;

    @Column(nullable = false)
    private String log;

    protected Importacao() {
    }

    public Importacao(String nomeArquivo, String origem, LocalDateTime realizadaEm,
                      int importados, int ignorados, int comErro, String log) {
        this.nomeArquivo = nomeArquivo;
        this.origem = origem;
        this.realizadaEm = realizadaEm;
        this.importados = importados;
        this.ignorados = ignorados;
        this.comErro = comErro;
        this.log = log;
    }

    public boolean isSucessoTotal() {
        return comErro == 0;
    }

    public Long getId() {
        return id;
    }

    public String getNomeArquivo() {
        return nomeArquivo;
    }

    public String getOrigem() {
        return origem;
    }

    public LocalDateTime getRealizadaEm() {
        return realizadaEm;
    }

    public int getImportados() {
        return importados;
    }

    public int getIgnorados() {
        return ignorados;
    }

    public int getComErro() {
        return comErro;
    }

    public String getLog() {
        return log;
    }
}
