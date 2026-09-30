package br.com.libok.configuracao;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Preferências da biblioteca (linha única, id = 1). */
@Entity
@Table(name = "configuracao")
public class Configuracao {

    @Id
    private Long id = 1L;

    @Column(name = "nome_biblioteca", nullable = false)
    private String nomeBiblioteca;

    @Column(name = "prazo_emprestimo_dias", nullable = false)
    private int prazoEmprestimoDias;

    @Column(name = "limite_emprestimos", nullable = false)
    private int limiteEmprestimos;

    @Column(name = "bloquear_com_atraso", nullable = false)
    private boolean bloquearComAtraso;

    public Long getId() {
        return id;
    }

    public String getNomeBiblioteca() {
        return nomeBiblioteca;
    }

    public void setNomeBiblioteca(String nomeBiblioteca) {
        this.nomeBiblioteca = nomeBiblioteca;
    }

    public int getPrazoEmprestimoDias() {
        return prazoEmprestimoDias;
    }

    public void setPrazoEmprestimoDias(int prazoEmprestimoDias) {
        this.prazoEmprestimoDias = prazoEmprestimoDias;
    }

    public int getLimiteEmprestimos() {
        return limiteEmprestimos;
    }

    public void setLimiteEmprestimos(int limiteEmprestimos) {
        this.limiteEmprestimos = limiteEmprestimos;
    }

    public boolean isBloquearComAtraso() {
        return bloquearComAtraso;
    }

    public void setBloquearComAtraso(boolean bloquearComAtraso) {
        this.bloquearComAtraso = bloquearComAtraso;
    }
}
