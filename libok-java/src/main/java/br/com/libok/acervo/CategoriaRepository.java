package br.com.libok.acervo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface CategoriaRepository extends JpaRepository<Categoria, Long> {

    Optional<Categoria> findByNomeNormalizado(String nomeNormalizado);

    List<Categoria> findAllByOrderByNomeNormalizadoAsc();

    /** Categorias com ao menos um livro (as demais ficam órfãs após exclusões). */
    @Query("select distinct l.categoria from Livro l order by l.categoria.nomeNormalizado")
    List<Categoria> findEmUso();
}
