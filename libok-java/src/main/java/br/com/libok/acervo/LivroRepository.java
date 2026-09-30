package br.com.libok.acervo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LivroRepository extends JpaRepository<Livro, Long> {

    Optional<Livro> findByTituloNormalizado(String tituloNormalizado);

    @Query("select l.tituloNormalizado from Livro l")
    List<String> findTodosTitulosNormalizados();

    @Query("""
            select l from Livro l
            where (:busca is null or l.textoBusca like concat('%', :busca, '%'))
              and (:categoriaId is null or l.categoria.id = :categoriaId)
              and (:somenteDisponiveis = false or exists (
                    select 1 from Exemplar e where e.livro = l
                      and e.situacao = br.com.libok.acervo.SituacaoExemplar.DISPONIVEL))
            """)
    Page<Livro> buscar(String busca, Long categoriaId, boolean somenteDisponiveis, Pageable paginacao);

    @Query("select l from Livro l order by l.tituloNormalizado")
    List<Livro> findTodosOrdenados();
}
