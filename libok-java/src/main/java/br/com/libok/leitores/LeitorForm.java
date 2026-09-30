package br.com.libok.leitores;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class LeitorForm {

    @NotBlank(message = "Informe o nome do leitor.")
    @Size(max = 150, message = "O nome pode ter no máximo 150 caracteres.")
    private String nome;

    @Size(max = 50, message = "A matrícula pode ter no máximo 50 caracteres.")
    private String matricula;

    @Size(max = 60, message = "A turma pode ter no máximo 60 caracteres.")
    private String turma;

    @Size(max = 30, message = "O telefone pode ter no máximo 30 caracteres.")
    private String telefone;

    @Email(message = "Informe um e-mail válido.")
    @Size(max = 150, message = "O e-mail pode ter no máximo 150 caracteres.")
    private String email;

    @Size(max = 1000, message = "A observação pode ter no máximo 1000 caracteres.")
    private String observacao;

    public static LeitorForm de(Leitor leitor) {
        LeitorForm form = new LeitorForm();
        form.nome = leitor.getNome();
        form.matricula = leitor.getMatricula();
        form.turma = leitor.getTurma();
        form.telefone = leitor.getTelefone();
        form.email = leitor.getEmail();
        form.observacao = leitor.getObservacao();
        return form;
    }

    public String getNome() {
        return nome;
    }

    public void setNome(String nome) {
        this.nome = nome;
    }

    public String getMatricula() {
        return matricula;
    }

    public void setMatricula(String matricula) {
        this.matricula = matricula;
    }

    public String getTurma() {
        return turma;
    }

    public void setTurma(String turma) {
        this.turma = turma;
    }

    public String getTelefone() {
        return telefone;
    }

    public void setTelefone(String telefone) {
        this.telefone = telefone;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }
}
