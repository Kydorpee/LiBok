package br.com.libok.acervo;

public enum SituacaoExemplar {
    DISPONIVEL("Disponível"),
    EMPRESTADO("Emprestado"),
    BAIXADO("Baixado");

    private final String rotulo;

    SituacaoExemplar(String rotulo) {
        this.rotulo = rotulo;
    }

    public String getRotulo() {
        return rotulo;
    }
}
