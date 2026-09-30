package br.com.libok.acervo;

import br.com.libok.comum.Textos;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.hibernate.annotations.BatchSize;

@Entity
@Table(name = "livro")
public class Livro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String titulo;

    @Column(name = "titulo_normalizado", nullable = false, unique = true)
    private String tituloNormalizado;

    @Column(nullable = false)
    private String autor;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "categoria_id")
    private Categoria categoria;

    @Column(nullable = false)
    private String assunto;

    private String isbn;

    @Column(name = "ano_publicacao")
    private Integer anoPublicacao;

    private String descricao;

    /** Título, autor, categoria, assunto, ISBN e códigos normalizados, para a busca em SQL. */
    @Column(name = "texto_busca", nullable = false)
    private String textoBusca;

    @Column(name = "criado_em", nullable = false)
    private LocalDateTime criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private LocalDateTime atualizadoEm;

    @OneToMany(mappedBy = "livro", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    @BatchSize(size = 100)
    private List<Exemplar> exemplares = new ArrayList<>();

    protected Livro() {
    }

    public Livro(LocalDateTime agora) {
        this.criadoEm = agora;
        this.atualizadoEm = agora;
    }

    void preencher(String titulo, String autor, Categoria categoria, String assunto,
                   String isbn, Integer anoPublicacao, String descricao, LocalDateTime agora) {
        this.titulo = Textos.limpar(titulo);
        this.tituloNormalizado = Textos.normalizar(titulo);
        this.autor = Textos.limpar(autor);
        this.categoria = categoria;
        this.assunto = Textos.limpar(assunto);
        this.isbn = Textos.limpar(isbn);
        this.anoPublicacao = anoPublicacao;
        this.descricao = descricao == null || descricao.isBlank() ? null : descricao.strip();
        this.atualizadoEm = agora;
    }

    Exemplar adicionarExemplar(String codigo) {
        Exemplar exemplar = new Exemplar(this, codigo);
        exemplares.add(exemplar);
        return exemplar;
    }

    void removerExemplar(Exemplar exemplar) {
        exemplares.remove(exemplar);
    }

    void atualizarTextoBusca() {
        Stream<String> campos = Stream.of(titulo, autor, categoria.getNome(), assunto, isbn);
        Stream<String> codigos = exemplares.stream().map(Exemplar::getCodigo);
        this.textoBusca = Stream.concat(campos, codigos)
                .filter(Objects::nonNull)
                .map(Textos::normalizar)
                .collect(Collectors.joining(" | "));
    }

    public String getSigla() {
        return sigla(titulo);
    }

    /** Até duas iniciais das palavras principais do título, para a "capa" desenhada. */
    public static String sigla(String titulo) {
        StringBuilder sigla = new StringBuilder();
        for (String palavra : titulo.split(" ")) {
            if (palavra.length() > 2 && Character.isLetterOrDigit(palavra.charAt(0)) && sigla.length() < 2) {
                sigla.append(Character.toUpperCase(palavra.charAt(0)));
            }
        }
        return sigla.isEmpty() ? titulo.substring(0, 1).toUpperCase(Locale.ROOT) : sigla.toString();
    }

    public List<Exemplar> getExemplaresAtivos() {
        return exemplares.stream().filter(exemplar -> !exemplar.isBaixado()).toList();
    }

    public int getQuantidade() {
        return getExemplaresAtivos().size();
    }

    public int getDisponiveis() {
        return (int) exemplares.stream().filter(Exemplar::isDisponivel).count();
    }

    public Long getId() {
        return id;
    }

    public String getTitulo() {
        return titulo;
    }

    public String getTituloNormalizado() {
        return tituloNormalizado;
    }

    public String getAutor() {
        return autor;
    }

    public Categoria getCategoria() {
        return categoria;
    }

    public String getAssunto() {
        return assunto;
    }

    public String getIsbn() {
        return isbn;
    }

    public Integer getAnoPublicacao() {
        return anoPublicacao;
    }

    public String getDescricao() {
        return descricao;
    }

    public String getTextoBusca() {
        return textoBusca;
    }

    public LocalDateTime getCriadoEm() {
        return criadoEm;
    }

    public LocalDateTime getAtualizadoEm() {
        return atualizadoEm;
    }

    public List<Exemplar> getExemplares() {
        return exemplares;
    }
}
