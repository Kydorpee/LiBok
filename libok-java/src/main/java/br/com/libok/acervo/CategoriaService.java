package br.com.libok.acervo;

import br.com.libok.comum.Textos;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CategoriaService {

    /**
     * Paleta categórica fixa: cada nova categoria recebe a próxima cor na ordem de criação, e a cor
     * acompanha a categoria para sempre (nunca muda conforme o ranking no gráfico).
     */
    static final List<String> PALETA = List.of(
            "#2a78d6", "#eb6834", "#1baf7a", "#eda100",
            "#e87ba4", "#008300", "#4a3aa7", "#e34948");

    private final CategoriaRepository categorias;

    public CategoriaService(CategoriaRepository categorias) {
        this.categorias = categorias;
    }

    /** Devolve a categoria existente com o mesmo nome (ignorando acentos e maiúsculas) ou cria uma nova. */
    @Transactional
    public Categoria obterOuCriar(String nome) {
        String normalizado = Textos.normalizar(nome);
        return categorias.findByNomeNormalizado(normalizado)
                .orElseGet(() -> {
                    String cor = PALETA.get((int) (categorias.count() % PALETA.size()));
                    return categorias.save(new Categoria(Textos.limpar(nome), normalizado, cor));
                });
    }

    @Transactional(readOnly = true)
    public List<Categoria> emUso() {
        return categorias.findEmUso();
    }

    @Transactional(readOnly = true)
    public List<Categoria> todas() {
        return categorias.findAllByOrderByNomeNormalizadoAsc();
    }
}
