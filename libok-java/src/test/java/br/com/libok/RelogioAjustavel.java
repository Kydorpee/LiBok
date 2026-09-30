package br.com.libok;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Relógio dos testes: permite "avançar o tempo" para simular atrasos. */
public class RelogioAjustavel extends Clock {

    private static final ZoneId FUSO = ZoneId.of("America/Sao_Paulo");
    private Instant agora;

    public RelogioAjustavel(LocalDate data) {
        definir(data);
    }

    public void definir(LocalDate data) {
        this.agora = data.atTime(10, 0).atZone(FUSO).toInstant();
    }

    public void avancarDias(long dias) {
        this.agora = agora.plusSeconds(dias * 86_400);
    }

    @Override
    public ZoneId getZone() {
        return FUSO;
    }

    @Override
    public Clock withZone(ZoneId zona) {
        return this;
    }

    @Override
    public Instant instant() {
        return agora;
    }
}
