package br.com.libok.painel;

import br.com.libok.acervo.ExemplarRepository;
import br.com.libok.acervo.Livro;
import br.com.libok.acervo.LivroRepository;
import br.com.libok.acervo.SituacaoExemplar;
import br.com.libok.emprestimos.Emprestimo;
import br.com.libok.emprestimos.EmprestimoRepository;
import br.com.libok.leitores.Leitor;
import br.com.libok.leitores.LeitorRepository;
import br.com.libok.painel.PainelDados.Acervo;
import br.com.libok.painel.PainelDados.FatiaCategoria;
import br.com.libok.painel.PainelDados.Indicador;
import br.com.libok.painel.PainelDados.ItemRanking;
import br.com.libok.painel.PainelDados.Serie;
import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PainelService {

    /** O gráfico de categorias mostra as maiores e agrupa o restante em "Outras". */
    private static final int MAX_FATIAS = 7;
    private static final int DIAS_AGRUPAMENTO_DIARIO = 92;
    private static final Locale PT_BR = Locale.of("pt", "BR");

    private final EmprestimoRepository emprestimos;
    private final LeitorRepository leitores;
    private final LivroRepository livros;
    private final ExemplarRepository exemplares;
    private final Clock relogio;

    public PainelService(EmprestimoRepository emprestimos, LeitorRepository leitores, LivroRepository livros,
                         ExemplarRepository exemplares, Clock relogio) {
        this.emprestimos = emprestimos;
        this.leitores = leitores;
        this.livros = livros;
        this.exemplares = exemplares;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public PainelDados dados(LocalDate inicio, LocalDate fim) {
        LocalDate hoje = LocalDate.now(relogio);
        long dias = ChronoUnit.DAYS.between(inicio, fim) + 1;
        LocalDate inicioAnterior = inicio.minusDays(dias);
        LocalDate fimAnterior = inicio.minusDays(1);

        List<Emprestimo> doPeriodo = emprestimos.findNoPeriodo(inicio, fim);
        List<Emprestimo> doAnterior = emprestimos.findNoPeriodo(inicioAnterior, fimAnterior);
        List<Leitor> novos = leitores.findByCriadoEmBetween(inicio.atStartOfDay(), fim.plusDays(1).atStartOfDay());
        List<Leitor> novosAnterior = leitores.findByCriadoEmBetween(
                inicioAnterior.atStartOfDay(), inicio.atStartOfDay());

        Indicador indicadorEmprestimos = new Indicador(doPeriodo.size(),
                variacao(doPeriodo.size(), doAnterior.size()),
                porDia(inicio, fim, doPeriodo, Emprestimo::getDataEmprestimo));
        Indicador indicadorNovos = new Indicador(novos.size(),
                variacao(novos.size(), novosAnterior.size()),
                porDia(inicio, fim, novos, leitor -> leitor.getCriadoEm().toLocalDate()));
        long ativos = leitoresDistintos(doPeriodo);
        Indicador indicadorAtivos = new Indicador(ativos,
                variacao(ativos, leitoresDistintos(doAnterior)),
                leitoresAtivosPorDia(inicio, fim, doPeriodo));

        List<Emprestimo> abertos = emprestimos.findAtivos();
        long atrasados = abertos.stream().filter(emprestimo -> emprestimo.isAtrasado(hoje)).count();
        long vencemEmBreve = abertos.stream()
                .filter(emprestimo -> !emprestimo.isAtrasado(hoje) && emprestimo.diasParaVencer(hoje) <= 3)
                .count();

        Acervo acervo = new Acervo(livros.count(),
                exemplares.countBySituacaoNot(SituacaoExemplar.BAIXADO),
                exemplares.countBySituacao(SituacaoExemplar.DISPONIVEL),
                exemplares.countBySituacao(SituacaoExemplar.EMPRESTADO));

        return new PainelDados(inicio, fim, indicadorEmprestimos, indicadorNovos, indicadorAtivos,
                atrasados, vencemEmBreve, acervo, maisEmprestados(doPeriodo), topLeitores(doPeriodo),
                categorias(), tendencia(inicio, fim, doPeriodo));
    }

    private static Integer variacao(long atual, long anterior) {
        if (anterior == 0) {
            return null;
        }
        return (int) Math.round((atual - anterior) * 100.0 / anterior);
    }

    private static long leitoresDistintos(List<Emprestimo> lista) {
        return lista.stream().map(emprestimo -> emprestimo.getLeitor().getId()).distinct().count();
    }

    private static <T> List<Long> porDia(LocalDate inicio, LocalDate fim, List<T> itens, Function<T, LocalDate> data) {
        Map<LocalDate, Long> contagem = itens.stream().collect(Collectors.groupingBy(data, Collectors.counting()));
        List<Long> serie = new ArrayList<>();
        for (LocalDate dia = inicio; !dia.isAfter(fim); dia = dia.plusDays(1)) {
            serie.add(contagem.getOrDefault(dia, 0L));
        }
        return serie;
    }

    private static List<Long> leitoresAtivosPorDia(LocalDate inicio, LocalDate fim, List<Emprestimo> lista) {
        Map<LocalDate, Long> contagem = lista.stream().collect(Collectors.groupingBy(
                Emprestimo::getDataEmprestimo,
                Collectors.collectingAndThen(
                        Collectors.mapping(emprestimo -> emprestimo.getLeitor().getId(), Collectors.toSet()),
                        conjunto -> (long) conjunto.size())));
        List<Long> serie = new ArrayList<>();
        for (LocalDate dia = inicio; !dia.isAfter(fim); dia = dia.plusDays(1)) {
            serie.add(contagem.getOrDefault(dia, 0L));
        }
        return serie;
    }

    private static List<ItemRanking> maisEmprestados(List<Emprestimo> lista) {
        return lista.stream()
                .collect(Collectors.groupingBy(emprestimo -> emprestimo.getExemplar().getLivro(), Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<Livro, Long>comparingByValue().reversed()
                        .thenComparing(entrada -> entrada.getKey().getTituloNormalizado()))
                .limit(5)
                .map(entrada -> new ItemRanking(entrada.getKey().getId(), entrada.getKey().getTitulo(),
                        entrada.getKey().getAutor(), entrada.getValue(), null, null))
                .toList();
    }

    private static List<ItemRanking> topLeitores(List<Emprestimo> lista) {
        return lista.stream()
                .collect(Collectors.groupingBy(Emprestimo::getLeitor, Collectors.counting()))
                .entrySet().stream()
                .sorted(Map.Entry.<Leitor, Long>comparingByValue().reversed()
                        .thenComparing(entrada -> entrada.getKey().getNomeNormalizado()))
                .limit(5)
                .map(entrada -> new ItemRanking(entrada.getKey().getId(), entrada.getKey().getNome(),
                        entrada.getKey().getResumo(), entrada.getValue(),
                        entrada.getKey().getIniciais(), entrada.getKey().getCorAvatar()))
                .toList();
    }

    private List<FatiaCategoria> categorias() {
        List<Object[]> linhas = exemplares.contarPorCategoria();
        long total = linhas.stream().mapToLong(linha -> (Long) linha[2]).sum();
        if (total == 0) {
            return List.of();
        }
        List<FatiaCategoria> fatias = new ArrayList<>();
        long outras = 0;
        for (int i = 0; i < linhas.size(); i++) {
            Object[] linha = linhas.get(i);
            long quantidade = (Long) linha[2];
            if (i < MAX_FATIAS || linhas.size() == MAX_FATIAS + 1) {
                fatias.add(new FatiaCategoria((String) linha[0], (String) linha[1], quantidade, percentual(quantidade, total)));
            } else {
                outras += quantidade;
            }
        }
        if (outras > 0) {
            fatias.add(new FatiaCategoria("Outras", "#9a9a94", outras, percentual(outras, total)));
        }
        return fatias;
    }

    private static double percentual(long parte, long total) {
        return Math.round(parte * 1000.0 / total) / 10.0;
    }

    private static Serie tendencia(LocalDate inicio, LocalDate fim, List<Emprestimo> lista) {
        long dias = ChronoUnit.DAYS.between(inicio, fim) + 1;
        if (dias <= DIAS_AGRUPAMENTO_DIARIO) {
            DateTimeFormatter formato = DateTimeFormatter.ofPattern("dd/MM", PT_BR);
            List<String> rotulos = new ArrayList<>();
            for (LocalDate dia = inicio; !dia.isAfter(fim); dia = dia.plusDays(1)) {
                rotulos.add(dia.format(formato));
            }
            return new Serie(rotulos, porDia(inicio, fim, lista, Emprestimo::getDataEmprestimo), "dia");
        }
        DateTimeFormatter formato = DateTimeFormatter.ofPattern("MMM/yy", PT_BR);
        Map<YearMonth, Long> porMes = new LinkedHashMap<>();
        for (YearMonth mes = YearMonth.from(inicio); !mes.isAfter(YearMonth.from(fim)); mes = mes.plusMonths(1)) {
            porMes.put(mes, 0L);
        }
        lista.forEach(emprestimo -> porMes.merge(YearMonth.from(emprestimo.getDataEmprestimo()), 1L, Long::sum));
        List<String> rotulos = porMes.keySet().stream().map(mes -> mes.format(formato)).toList();
        return new Serie(rotulos, List.copyOf(porMes.values()), "mês");
    }

    /** Próximas devoluções e atrasos, para a tabela do painel. */
    @Transactional(readOnly = true)
    public List<Emprestimo> proximasDevolucoes(int limite) {
        return emprestimos.findAtivos().stream()
                .sorted(Comparator.comparing(Emprestimo::getDataPrevista))
                .limit(limite)
                .toList();
    }
}
