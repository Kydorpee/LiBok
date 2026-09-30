package br.com.libok.emprestimos;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EmprestimoRepository extends JpaRepository<Emprestimo, Long> {

    String COMPLETO = "select e from Emprestimo e join fetch e.exemplar ex join fetch ex.livro join fetch e.leitor ";

    @Query(COMPLETO + "where e.id = :id")
    Optional<Emprestimo> findCompleto(Long id);

    @Query(COMPLETO + "where e.dataDevolucao is null order by e.dataPrevista, e.id")
    List<Emprestimo> findAtivos();

    @Query(COMPLETO + "where e.dataDevolucao is null and e.dataPrevista < :hoje order by e.dataPrevista, e.id")
    List<Emprestimo> findAtrasados(LocalDate hoje);

    @Query(value = COMPLETO + "where e.dataDevolucao is not null order by e.dataDevolucao desc, e.id desc",
            countQuery = "select count(e) from Emprestimo e where e.dataDevolucao is not null")
    Page<Emprestimo> findDevolvidos(Pageable paginacao);

    @Query(COMPLETO + "where e.leitor.id = :leitorId order by e.dataEmprestimo desc, e.id desc")
    List<Emprestimo> findPorLeitor(Long leitorId);

    @Query(COMPLETO + "where ex.livro.id = :livroId order by e.dataEmprestimo desc, e.id desc")
    List<Emprestimo> findPorLivro(Long livroId);

    @Query(COMPLETO + "where e.dataEmprestimo between :inicio and :fim")
    List<Emprestimo> findNoPeriodo(LocalDate inicio, LocalDate fim);

    @Query(COMPLETO + "order by e.dataEmprestimo desc, e.id desc")
    List<Emprestimo> findTodosCompletos();

    long countByDataDevolucaoIsNull();

    long countByDataDevolucaoIsNullAndDataPrevistaBefore(LocalDate hoje);

    long countByLeitorIdAndDataDevolucaoIsNull(Long leitorId);

    boolean existsByLeitorIdAndDataDevolucaoIsNullAndDataPrevistaBefore(Long leitorId, LocalDate hoje);

    boolean existsByLeitorId(Long leitorId);

    boolean existsByExemplarId(Long exemplarId);

    boolean existsByExemplarLivroIdAndDataDevolucaoIsNull(Long livroId);

    @Query(COMPLETO + "where e.exemplar.id = :exemplarId and e.dataDevolucao is null")
    Optional<Emprestimo> findAtivoDoExemplar(Long exemplarId);
}
