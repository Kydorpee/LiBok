package br.com.libok.importacao;

import java.util.List;

/** Prévia da importação: o que será gravado, o que será ignorado e o que tem erro. */
public record AnaliseImportacao(List<Item> itens, List<String> errosDeFormato) {

    public enum Situacao { VALIDO, DUPLICADO, ERRO }

    public record Item(LinhaImportacao linha, Situacao situacao, String mensagem) {
    }

    public List<Item> validos() {
        return itens.stream().filter(item -> item.situacao() == Situacao.VALIDO).toList();
    }

    public long totalValidos() {
        return validos().size();
    }

    public long totalDuplicados() {
        return itens.stream().filter(item -> item.situacao() == Situacao.DUPLICADO).count();
    }

    public long totalErros() {
        return errosDeFormato.size() + itens.stream().filter(item -> item.situacao() == Situacao.ERRO).count();
    }
}
