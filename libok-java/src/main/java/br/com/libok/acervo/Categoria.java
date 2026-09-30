package br.com.libok.acervo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "categoria")
public class Categoria {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(name = "nome_normalizado", nullable = false, unique = true)
    private String nomeNormalizado;

    @Column(nullable = false)
    private String cor;

    protected Categoria() {
    }

    public Categoria(String nome, String nomeNormalizado, String cor) {
        this.nome = nome;
        this.nomeNormalizado = nomeNormalizado;
        this.cor = cor;
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getNomeNormalizado() {
        return nomeNormalizado;
    }

    public String getCor() {
        return cor;
    }
}
