package br.com.libok.importacao;

import java.io.Serializable;
import java.util.List;

/** Resultado da leitura de um arquivo: as linhas bem formadas e os erros de formato. */
public record LeituraArquivo(List<LinhaImportacao> linhas, List<String> erros) implements Serializable {
}
