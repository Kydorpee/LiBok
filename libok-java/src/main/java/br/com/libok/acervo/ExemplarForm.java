package br.com.libok.acervo;

public class ExemplarForm {

    /** Preenchido quando o exemplar já existe (edição). */
    private Long id;
    private String codigo;

    public ExemplarForm() {
    }

    public ExemplarForm(Long id, String codigo) {
        this.id = id;
        this.codigo = codigo;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCodigo() {
        return codigo;
    }

    public void setCodigo(String codigo) {
        this.codigo = codigo;
    }
}
