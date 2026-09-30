package br.com.libok.configuracao;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Aplica um backup escolhido para restauração. Roda antes do Spring subir, quando nenhuma conexão
 * está aberta; o banco atual é guardado em backups/ para que nada se perca.
 */
public final class RestauracaoPendente {

    public static final String ARQUIVO_BANCO = "libok.db";
    public static final String ARQUIVO_PENDENTE = "libok.db.restaurar";
    private static final String[] SUFIXOS_SQLITE = {"", "-wal", "-shm"};

    private RestauracaoPendente() {
    }

    public static boolean aplicar(Path pasta) {
        Path pendente = pasta.resolve(ARQUIVO_PENDENTE);
        if (!Files.isRegularFile(pendente)) {
            return false;
        }
        try {
            Path backups = Files.createDirectories(pasta.resolve(BackupService.PASTA_BACKUPS));
            String carimbo = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
            Path copiaAnterior = backups.resolve("antes-da-restauracao-" + carimbo + ".db");
            for (String sufixo : SUFIXOS_SQLITE) {
                Path atual = pasta.resolve(ARQUIVO_BANCO + sufixo);
                if (Files.exists(atual)) {
                    Files.move(atual, Path.of(copiaAnterior + sufixo), StandardCopyOption.REPLACE_EXISTING);
                }
            }
            Files.move(pendente, pasta.resolve(ARQUIVO_BANCO), StandardCopyOption.REPLACE_EXISTING);
            return true;
        } catch (IOException erro) {
            throw new UncheckedIOException("Não foi possível restaurar o backup", erro);
        }
    }
}
