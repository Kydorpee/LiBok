package br.com.libok.desktop;

import java.awt.Desktop;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Abre a interface do LiBok. No Windows usa o Microsoft Edge (ou Chrome) em modo aplicativo,
 * que mostra uma janela própria, sem abas nem barra de endereço. Sem eles, usa o navegador padrão.
 */
public final class AberturaNavegador {

    private static final Logger log = LoggerFactory.getLogger(AberturaNavegador.class);

    private AberturaNavegador() {
    }

    public static void abrir(String url) {
        if (abrirEmModoAplicativo(url)) {
            return;
        }
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(URI.create(url));
                return;
            }
            String sistema = System.getProperty("os.name").toLowerCase(Locale.ROOT);
            if (sistema.contains("win")) {
                new ProcessBuilder("rundll32", "url.dll,FileProtocolHandler", url).start();
            } else if (sistema.contains("mac")) {
                new ProcessBuilder("open", url).start();
            } else {
                new ProcessBuilder("xdg-open", url).start();
            }
        } catch (Exception erro) {
            log.warn("Não foi possível abrir o navegador. Acesse {} manualmente.", url, erro);
        }
    }

    private static boolean abrirEmModoAplicativo(String url) {
        if (!System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("win")) {
            return false;
        }
        Optional<Path> navegador = localizarNavegadorWindows();
        if (navegador.isEmpty()) {
            return false;
        }
        try {
            new ProcessBuilder(navegador.get().toString(), "--app=" + url, "--window-size=1280,820").start();
            return true;
        } catch (Exception erro) {
            log.debug("Falha ao abrir em modo aplicativo", erro);
            return false;
        }
    }

    private static Optional<Path> localizarNavegadorWindows() {
        List<String> bases = List.of(
                env("ProgramFiles(x86)"), env("ProgramFiles"), env("LOCALAPPDATA"));
        List<String> relativos = List.of(
                "Microsoft/Edge/Application/msedge.exe",
                "Google/Chrome/Application/chrome.exe");
        for (String relativo : relativos) {
            for (String base : bases) {
                if (base.isEmpty()) {
                    continue;
                }
                Path candidato = Path.of(base, relativo);
                if (Files.isRegularFile(candidato)) {
                    return Optional.of(candidato);
                }
            }
        }
        return Optional.empty();
    }

    private static String env(String nome) {
        String valor = System.getenv(nome);
        return valor == null ? "" : valor;
    }
}
