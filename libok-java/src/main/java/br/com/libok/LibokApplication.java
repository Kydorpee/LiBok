package br.com.libok;

import br.com.libok.desktop.AberturaNavegador;
import br.com.libok.desktop.InstanciaUnica;
import br.com.libok.desktop.PastaDados;
import br.com.libok.configuracao.RestauracaoPendente;
import java.nio.file.Path;
import java.time.Clock;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.annotation.Bean;

@SpringBootApplication
public class LibokApplication {

    public static final int PORTA_PADRAO = 8765;

    public static void main(String[] args) {
        Path pasta = PastaDados.preparar();
        int porta = Integer.getInteger("libok.porta", PORTA_PADRAO);

        // Se o LiBok já estiver aberto, apenas mostra a janela existente.
        if (InstanciaUnica.emExecucao(porta)) {
            AberturaNavegador.abrir("http://localhost:" + porta + "/");
            return;
        }

        RestauracaoPendente.aplicar(pasta);

        new SpringApplicationBuilder(LibokApplication.class)
                .headless(false)
                .run(args);
    }

    @Bean
    Clock relogio() {
        return Clock.systemDefaultZone();
    }
}
