package br.com.libok.acervo;

import org.springframework.data.domain.Sort;

public class FiltroAcervo {

    private String busca;
    private Long categoria;
    private boolean disponiveis;
    private String ordem = "titulo";
    private int pagina;

    public Sort ordenacao() {
        return switch (ordem == null ? "" : ordem) {
            case "autor" -> Sort.by("autor", "tituloNormalizado");
            case "recentes" -> Sort.by(Sort.Direction.DESC, "criadoEm", "id");
            default -> Sort.by("tituloNormalizado");
        };
    }

    public String getBusca() {
        return busca;
    }

    public void setBusca(String busca) {
        this.busca = busca;
    }

    public Long getCategoria() {
        return categoria;
    }

    public void setCategoria(Long categoria) {
        this.categoria = categoria;
    }

    public boolean isDisponiveis() {
        return disponiveis;
    }

    public void setDisponiveis(boolean disponiveis) {
        this.disponiveis = disponiveis;
    }

    public String getOrdem() {
        return ordem;
    }

    public void setOrdem(String ordem) {
        this.ordem = ordem;
    }

    public int getPagina() {
        return Math.max(0, pagina);
    }

    public void setPagina(int pagina) {
        this.pagina = pagina;
    }
}
