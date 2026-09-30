package br.com.libok.importacao;

import br.com.libok.acervo.ExemplarForm;
import br.com.libok.acervo.LivroForm;
import java.io.Serializable;
import java.util.List;

/** Um livro lido de um CSV ou do banco do LiBok antigo, antes de ser gravado. */
public record LinhaImportacao(
        int linha,
        String titulo,
        String autor,
        String categoria,
        String assunto,
        List<String> codigos,
        String isbn,
        Integer anoPublicacao,
        String descricao) implements Serializable {

    public LivroForm paraFormulario() {
        LivroForm form = new LivroForm();
        form.setTitulo(titulo);
        form.setAutor(autor);
        form.setCategoria(categoria);
        form.setAssunto(assunto);
        form.setIsbn(isbn);
        form.setAnoPublicacao(anoPublicacao);
        form.setDescricao(descricao);
        form.setExemplares(codigos.stream().map(codigo -> new ExemplarForm(null, codigo)).toList());
        return form;
    }
}
