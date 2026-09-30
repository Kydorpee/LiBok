package br.com.libok.configuracao;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ConfiguracaoForm {

    @NotBlank(message = "Informe o nome da biblioteca.")
    @Size(max = 80, message = "O nome pode ter no máximo 80 caracteres.")
    private String nomeBiblioteca;

    @Min(value = 1, message = "O prazo deve ser de pelo menos 1 dia.")
    @Max(value = 365, message = "O prazo pode ser de no máximo 365 dias.")
    private int prazoEmprestimoDias;

    @Min(value = 1, message = "O limite deve ser de pelo menos 1 livro.")
    @Max(value = 50, message = "O limite pode ser de no máximo 50 livros.")
    private int limiteEmprestimos;

    private boolean bloquearComAtraso;

    public static ConfiguracaoForm de(Configuracao configuracao) {
        ConfiguracaoForm form = new ConfiguracaoForm();
        form.nomeBiblioteca = configuracao.getNomeBiblioteca();
        form.prazoEmprestimoDias = configuracao.getPrazoEmprestimoDias();
        form.limiteEmprestimos = configuracao.getLimiteEmprestimos();
        form.bloquearComAtraso = configuracao.isBloquearComAtraso();
        return form;
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
