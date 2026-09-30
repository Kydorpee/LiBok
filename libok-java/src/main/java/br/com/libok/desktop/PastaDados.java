package br.com.libok.desktop;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * Define onde ficam o banco, os logs e os backups: %APPDATA%\LiBok2 no Windows e ~/.libok2 nos
 * demais sistemas. Pode ser trocada com -Dlibok.pasta-dados=/caminho. A pasta é diferente da usada
 * pela versão antiga (%APPDATA%\LiBok), para que os dois programas não disputem o mesmo arquivo.
 */
public final class PastaDados {

    public static final String PROPRIEDADE = "libok.pasta-dados";

    private PastaDados() {
    }

    public static Path preparar() {
        String configurada = System.getProperty(PROPRIEDADE);
        Path pasta = configurada != null && !configurada.isBlank()
                ? Path.of(configurada)
                : padrao();
        try {
            Files.createDirectories(pasta);
        } catch (IOException erro) {
            throw new UncheckedIOException("Não foi possível criar a pasta de dados " + pasta, erro);
        }
        String caminho = pasta.toAbsolutePath().toString().replace('\\', '/');
        System.setProperty(PROPRIEDADE, caminho);
        return pasta.toAbsolutePath();
    }

    private static Path padrao() {
        String appData = System.getenv("APPDATA");
        if (appData != null && !appData.isBlank()) {
            return Path.of(appData, "LiBok2");
        }
        return Path.of(System.getProperty("user.home"), ".libok2");
    }

    /** Onde o LiBok antigo (Python, versão .exe) guardava o banco, se existir neste computador. */
    public static Optional<Path> bancoDaVersaoAntiga() {
        String appData = System.getenv("APPDATA");
        if (appData == null || appData.isBlank()) {
            return Optional.empty();
        }
        Path antigo = Path.of(appData, "LiBok", "libok.db");
        return Files.isRegularFile(antigo) ? Optional.of(antigo) : Optional.empty();
    }
}
