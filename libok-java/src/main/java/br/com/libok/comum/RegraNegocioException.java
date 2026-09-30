package br.com.libok.comum;

/** Erro de regra de negócio com mensagem pronta para mostrar ao usuário. */
public class RegraNegocioException extends RuntimeException {

    public RegraNegocioException(String mensagem) {
        super(mensagem);
    }
}
