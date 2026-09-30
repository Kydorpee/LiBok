package br.com.libok.painel;

import java.time.LocalDate;
import java.util.List;

/** Tudo o que o painel mostra para um período. Serializado em JSON para os gráficos. */
public record PainelDados(
        LocalDate inicio,
        LocalDate fim,
        Indicador emprestimos,
        Indicador novosLeitores,
        Indicador leitoresAtivos,
        long atrasados,
        long vencemEmBreve,
        Acervo acervo,
        List<ItemRanking> maisEmprestados,
        List<ItemRanking> topLeitores,
        List<FatiaCategoria> categorias,
        Serie tendencia) {

    /** Valor do período, variação percentual frente ao período anterior (nula se não houver base) e minigráfico. */
    public record Indicador(long valor, Integer variacao, List<Long> sparkline) {
    }

    public record Acervo(long titulos, long exemplares, long disponiveis, long emprestados) {
    }

    public record ItemRanking(Long id, String nome, String detalhe, long total, String iniciais, String cor) {
    }

    public record FatiaCategoria(String nome, String cor, long total, double percentual) {
    }

    public record Serie(List<String> rotulos, List<Long> valores, String agrupamento) {
    }
}
