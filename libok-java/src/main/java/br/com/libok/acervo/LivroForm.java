package br.com.libok.acervo;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.ArrayList;
import java.util.List;

public class LivroForm {

    @NotBlank(message = "Informe o título do livro.")
    @Size(max = 250, message = "O título pode ter no máximo 250 caracteres.")
    private String titulo;

    @NotBlank(message = "Informe o autor.")
    @Size(max = 200, message = "O autor pode ter no máximo 200 caracteres.")
    private String autor;

    @NotBlank(message = "Informe a categoria.")
    @Size(max = 80, message = "A categoria pode ter no máximo 80 caracteres.")
    private String categoria;

    @NotBlank(message = "Informe o assunto.")
    @Size(max = 200, message = "O assunto pode ter no máximo 200 caracteres.")
    private String assunto;

    @Size(max = 20, message = "O ISBN pode ter no máximo 20 caracteres.")
    private String isbn;

    @Min(value = 1000, message = "Informe um ano com quatro dígitos.")
    @Max(value = 2100, message = "Informe um ano válido.")
    private Integer anoPublicacao;

    @Size(max = 2000, message = "A descrição pode ter no máximo 2000 caracteres.")
    private String descricao;

    private List<ExemplarForm> exemplares = new ArrayList<>();

    public static LivroForm novo() {
        LivroForm form = new LivroForm();
        form.exemplares.add(new ExemplarForm());
        return form;
    }

    public static LivroForm de(Livro livro) {
        LivroForm form = new LivroForm();
        form.titulo = livro.getTitulo();
        form.autor = livro.getAutor();
        form.categoria = livro.getCategoria().getNome();
        form.assunto = livro.getAssunto();
        form.isbn = livro.getIsbn();
        form.anoPublicacao = livro.getAnoPublicacao();
        form.descricao = livro.getDescricao();
        livro.getExemplaresAtivos()
                .forEach(exemplar -> form.exemplares.add(new ExemplarForm(exemplar.getId(), exemplar.getCodigo())));
        return form;
    }

    public String getTitulo() {
        return titulo;
    }

    public void setTitulo(String titulo) {
        this.titulo = titulo;
    }

    public String getAutor() {
        return autor;
    }

    public void setAutor(String autor) {
        this.autor = autor;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getAssunto() {
        return assunto;
    }

    public void setAssunto(String assunto) {
        this.assunto = assunto;
    }

    public String getIsbn() {
        return isbn;
    }

    public void setIsbn(String isbn) {
        this.isbn = isbn;
    }

    public Integer getAnoPublicacao() {
        return anoPublicacao;
    }

    public void setAnoPublicacao(Integer anoPublicacao) {
        this.anoPublicacao = anoPublicacao;
    }

    public String getDescricao() {
        return descricao;
    }

    public void setDescricao(String descricao) {
        this.descricao = descricao;
    }

    public List<ExemplarForm> getExemplares() {
        return exemplares;
    }

    public void setExemplares(List<ExemplarForm> exemplares) {
        this.exemplares = exemplares;
    }
}
