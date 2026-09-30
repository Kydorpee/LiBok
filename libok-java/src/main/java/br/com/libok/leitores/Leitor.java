package br.com.libok.leitores;

import br.com.libok.comum.Textos;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@Entity
@Table(name = "leitor")
public class Leitor {

    private static final Set<String> CONECTIVOS = Set.of("da", "de", "do", "das", "dos", "e");

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nome;

    @Column(name = "nome_normalizado", nullable = false)
    private String nomeNormalizado;

    @Column(unique = true)
    private String matricula;

    private String turma;
    private String telefone;
    private String email;
    private String observacao;

    @Column(nullable = false)
    private boolean ativo = true;

    @Column(name = "criado_em", nullable = false)
    private LocalDateTime criadoEm;

    protected Leitor() {
    }

    public Leitor(LocalDateTime criadoEm) {
        this.criadoEm = criadoEm;
    }

    void preencher(LeitorForm form) {
        this.nome = Textos.limpar(form.getNome());
        this.nomeNormalizado = Textos.normalizar(form.getNome());
        this.matricula = Textos.limpar(form.getMatricula());
        this.turma = Textos.limpar(form.getTurma());
        this.telefone = Textos.limpar(form.getTelefone());
        this.email = Textos.limpar(form.getEmail());
        this.observacao = form.getObservacao() == null || form.getObservacao().isBlank()
                ? null : form.getObservacao().strip();
    }

    void inativar() {
        this.ativo = false;
    }

    void reativar() {
        this.ativo = true;
    }

    /** Iniciais usadas no avatar: "Maria da Silva" vira "MS". */
    public String getIniciais() {
        List<String> partes = Arrays.stream(nome.split(" "))
                .filter(parte -> !CONECTIVOS.contains(parte.toLowerCase(Locale.ROOT)))
                .toList();
        if (partes.isEmpty()) {
            partes = List.of(nome);
        }
        String iniciais = partes.getFirst().substring(0, 1)
                + (partes.size() > 1 ? partes.getLast().substring(0, 1) : "");
        return iniciais.toUpperCase(Locale.ROOT);
    }

    /** Cor pastel estável para o avatar, derivada do id. */
    public String getCorAvatar() {
        String[] cores = {"#CDEBD6", "#F6E3A1", "#CFE3F7", "#F8D5BE", "#E3D7F3", "#D5EFE9"};
        return cores[(int) (Math.abs(id == null ? 0 : id) % cores.length)];
    }

    public String getPrimeiroNome() {
        return Arrays.stream(nome.split(" ")).findFirst().orElse(nome);
    }

    public String getResumo() {
        return Arrays.stream(new String[] {matricula, turma})
                .filter(valor -> valor != null && !valor.isBlank())
                .collect(Collectors.joining(" · "));
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

    public String getMatricula() {
        return matricula;
    }

    public String getTurma() {
        return turma;
    }

    public String getTelefone() {
        return telefone;
    }

    public String getEmail() {
        return email;
    }

    public String getObservacao() {
        return observacao;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public LocalDateTime getCriadoEm() {
        return criadoEm;
    }
}
