package br.com.libok.acervo;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ExemplarRepository extends JpaRepository<Exemplar, Long> {

    @Query("select e from Exemplar e join fetch e.livro where e.codigoNormalizado = :codigo")
    Optional<Exemplar> findByCodigoNormalizado(String codigo);

    @Query("select e from Exemplar e join fetch e.livro where e.codigoNormalizado in :codigos")
    List<Exemplar> findByCodigoNormalizadoIn(Collection<String> codigos);

    @Query("select e.codigoNormalizado from Exemplar e")
    List<String> findTodosCodigosNormalizados();

    long countBySituacao(SituacaoExemplar situacao);

    long countBySituacaoNot(SituacaoExemplar situacao);

    @Query("""
            select e from Exemplar e join fetch e.livro l
            where e.situacao = br.com.libok.acervo.SituacaoExemplar.DISPONIVEL
            order by l.tituloNormalizado, e.codigoNormalizado
            """)
    List<Exemplar> findDisponiveis();

    /** Exemplares ativos (não baixados) por categoria: [nome, cor, quantidade]. */
    @Query("""
            select c.nome, c.cor, count(e) from Exemplar e join e.livro l join l.categoria c
            where e.situacao <> br.com.libok.acervo.SituacaoExemplar.BAIXADO
            group by c.id, c.nome, c.cor
            order by count(e) desc, c.nomeNormalizado
            """)
    List<Object[]> contarPorCategoria();
}
