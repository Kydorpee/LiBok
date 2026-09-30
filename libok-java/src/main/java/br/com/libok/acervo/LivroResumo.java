package br.com.libok.acervo;

/** Dados de um livro para os cards do acervo. */
public record LivroResumo(
        Long id,
        String titulo,
        String autor,
        String categoria,
        String corCategoria,
        String assunto,
        Integer anoPublicacao,
        int quantidade,
        int disponiveis) {

    static LivroResumo de(Livro livro) {
        return new LivroResumo(livro.getId(), livro.getTitulo(), livro.getAutor(),
                livro.getCategoria().getNome(), livro.getCategoria().getCor(), livro.getAssunto(),
                livro.getAnoPublicacao(), livro.getQuantidade(), livro.getDisponiveis());
    }

    public String getSigla() {
        return Livro.sigla(titulo);
    }
}
