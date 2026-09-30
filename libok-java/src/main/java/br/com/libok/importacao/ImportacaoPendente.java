package br.com.libok.importacao;

import java.io.Serializable;

/** Arquivo já lido e validado, guardado na sessão até o usuário confirmar a importação. */
public record ImportacaoPendente(String nomeArquivo, String origem, LeituraArquivo leitura) implements Serializable {
}
