package br.com.libok.desktop;

import java.awt.Image;
import java.awt.MenuItem;
import java.awt.PopupMenu;
import java.awt.SystemTray;
import java.awt.Toolkit;
import java.awt.TrayIcon;
import java.net.URL;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationContext;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Quando o servidor termina de subir, abre a janela do LiBok e coloca um ícone perto do relógio
 * do Windows com as opções "Abrir LiBok" e "Sair", para encerrar o programa de verdade.
 */
@Component
public class IntegracaoDesktop {

    private static final Logger log = LoggerFactory.getLogger(IntegracaoDesktop.class);

    private final ApplicationContext contexto;
    private final boolean abrirAoIniciar;
    private final int porta;

    public IntegracaoDesktop(ApplicationContext contexto,
                             @Value("${libok.abrir-navegador:true}") boolean abrirAoIniciar,
                             @Value("${server.port}") int porta) {
        this.contexto = contexto;
        this.abrirAoIniciar = abrirAoIniciar;
        this.porta = porta;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void aoIniciar() {
        String url = "http://localhost:" + porta + "/";
        log.info("LiBok disponível em {}", url);
        if (!abrirAoIniciar) {
            return;
        }
        instalarIconeBandeja(url);
        AberturaNavegador.abrir(url);
    }

    private void instalarIconeBandeja(String url) {
        if (!SystemTray.isSupported()) {
            return;
        }
        try {
            URL recurso = getClass().getResource("/static/img/icon.png");
            Image imagem = Toolkit.getDefaultToolkit().getImage(recurso);

            PopupMenu menu = new PopupMenu();
            MenuItem abrir = new MenuItem("Abrir LiBok");
            abrir.addActionListener(evento -> AberturaNavegador.abrir(url));
            MenuItem sair = new MenuItem("Sair");
            sair.addActionListener(evento -> encerrar());
            menu.add(abrir);
            menu.addSeparator();
            menu.add(sair);

            TrayIcon icone = new TrayIcon(imagem, "LiBok", menu);
            icone.setImageAutoSize(true);
            icone.addActionListener(evento -> AberturaNavegador.abrir(url));
            SystemTray.getSystemTray().add(icone);
        } catch (Exception erro) {
            log.warn("Não foi possível criar o ícone na bandeja do sistema", erro);
        }
    }

    private void encerrar() {
        int codigo = SpringApplication.exit(contexto, () -> 0);
        System.exit(codigo);
    }
}
