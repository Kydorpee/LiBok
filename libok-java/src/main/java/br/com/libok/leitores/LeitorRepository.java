package br.com.libok.leitores;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LeitorRepository extends JpaRepository<Leitor, Long> {

    Optional<Leitor> findByMatriculaIgnoreCase(String matricula);

    @Query("""
            select l from Leitor l
            where (:busca is null
                   or l.nomeNormalizado like concat('%', :busca, '%')
                   or lower(l.matricula) like concat('%', :busca, '%')
                   or lower(l.turma) like concat('%', :busca, '%'))
              and (:incluirInativos = true or l.ativo = true)
            order by l.ativo desc, l.nomeNormalizado
            """)
    Page<Leitor> buscar(String busca, boolean incluirInativos, Pageable paginacao);

    List<Leitor> findByAtivoTrueOrderByNomeNormalizadoAsc();

    List<Leitor> findByCriadoEmBetween(LocalDateTime inicio, LocalDateTime fim);

    long countByAtivoTrue();
}
