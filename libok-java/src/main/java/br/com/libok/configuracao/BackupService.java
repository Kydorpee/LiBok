package br.com.libok.configuracao;

import br.com.libok.comum.RegraNegocioException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

@Service
public class BackupService {

    public static final String PASTA_BACKUPS = "backups";
    private static final String PREFIXO_AUTOMATICO = "automatico-";
    private static final int BACKUPS_AUTOMATICOS_MANTIDOS = 10;
    private static final byte[] ASSINATURA_SQLITE = "SQLite format 3\0".getBytes(StandardCharsets.US_ASCII);
    private static final Logger log = LoggerFactory.getLogger(BackupService.class);

    private final JdbcTemplate jdbc;
    private final Path pastaDados;
    private final Clock relogio;

    public BackupService(JdbcTemplate jdbc, @Value("${libok.pasta-dados}") String pastaDados, Clock relogio) {
        this.jdbc = jdbc;
        this.pastaDados = Path.of(pastaDados);
        this.relogio = relogio;
    }

    public Path pastaDados() {
        return pastaDados;
    }

    public Path pastaBackups() {
        return pastaDados.resolve(PASTA_BACKUPS);
    }

    /** Cópia consistente do banco, feita pelo próprio SQLite mesmo com o programa em uso. */
    public Path gerarBackup() {
        String carimbo = LocalDateTime.now(relogio).format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"));
        return copiarPara("libok-backup-" + carimbo + ".db");
    }

    /** Um backup automático por dia, na primeira abertura; mantém os 10 mais recentes. */
    @EventListener(ApplicationReadyEvent.class)
    public void backupAutomatico() {
        try {
            String nome = PREFIXO_AUTOMATICO + LocalDate.now(relogio) + ".db";
            if (!Files.exists(pastaBackups().resolve(nome))) {
                copiarPara(nome);
            }
            List<Path> automaticos = listar().stream()
                    .filter(arquivo -> arquivo.getFileName().toString().startsWith(PREFIXO_AUTOMATICO))
                    .toList();
            for (Path antigo : automaticos.stream().skip(BACKUPS_AUTOMATICOS_MANTIDOS).toList()) {
                Files.deleteIfExists(antigo);
            }
        } catch (Exception erro) {
            log.warn("Backup automático não realizado", erro);
        }
    }

    /** Backups existentes, do mais recente para o mais antigo. */
    public List<Path> listar() {
        if (!Files.isDirectory(pastaBackups())) {
            return List.of();
        }
        try (Stream<Path> arquivos = Files.list(pastaBackups())) {
            return arquivos
                    .filter(arquivo -> arquivo.getFileName().toString().endsWith(".db"))
                    .sorted(Comparator.comparing(BackupService::modificadoEm).reversed())
                    .toList();
        } catch (IOException erro) {
            throw new UncheckedIOException(erro);
        }
    }

    public Path arquivoDeBackup(String nome) {
        Path arquivo = pastaBackups().resolve(nome).normalize();
        if (!arquivo.getParent().equals(pastaBackups().normalize()) || !Files.isRegularFile(arquivo)) {
            throw new RegraNegocioException("Backup não encontrado.");
        }
        return arquivo;
    }

    /**
     * Valida o arquivo e o deixa pronto para substituir o banco na próxima abertura do LiBok.
     * O banco atual é preservado em backups/.
     */
    public void agendarRestauracao(InputStream conteudo) {
        Path pendente = pastaDados.resolve(RestauracaoPendente.ARQUIVO_PENDENTE);
        Path temporario = pastaDados.resolve(RestauracaoPendente.ARQUIVO_PENDENTE + ".tmp");
        try {
            Files.copy(conteudo, temporario, StandardCopyOption.REPLACE_EXISTING);
            validarBackup(temporario);
            Files.move(temporario, pendente, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException erro) {
            throw new UncheckedIOException(erro);
        } finally {
            try {
                Files.deleteIfExists(temporario);
            } catch (IOException ignorado) {
                // o arquivo temporário será sobrescrito na próxima tentativa
            }
        }
    }

    public void agendarRestauracao(String nomeBackup) {
        try (InputStream entrada = Files.newInputStream(arquivoDeBackup(nomeBackup))) {
            agendarRestauracao(entrada);
        } catch (IOException erro) {
            throw new UncheckedIOException(erro);
        }
    }

    public boolean restauracaoAgendada() {
        return Files.exists(pastaDados.resolve(RestauracaoPendente.ARQUIVO_PENDENTE));
    }

    public void cancelarRestauracao() {
        try {
            Files.deleteIfExists(pastaDados.resolve(RestauracaoPendente.ARQUIVO_PENDENTE));
        } catch (IOException erro) {
            throw new UncheckedIOException(erro);
        }
    }

    private Path copiarPara(String nomeArquivo) {
        try {
            Path destino = Files.createDirectories(pastaBackups()).resolve(nomeArquivo);
            Files.deleteIfExists(destino);
            String caminho = destino.toAbsolutePath().toString().replace("'", "''");
            jdbc.execute("VACUUM INTO '" + caminho + "'");
            return destino;
        } catch (IOException erro) {
            throw new UncheckedIOException(erro);
        }
    }

    private static void validarBackup(Path arquivo) throws IOException {
        try (InputStream entrada = Files.newInputStream(arquivo)) {
            if (!Arrays.equals(entrada.readNBytes(ASSINATURA_SQLITE.length), ASSINATURA_SQLITE)) {
                throw new RegraNegocioException("O arquivo escolhido não é um backup do LiBok.");
            }
        }
        String url = "jdbc:sqlite:" + arquivo.toAbsolutePath() + "?open_mode=1";
        try (Connection conexao = DriverManager.getConnection(url);
             ResultSet tabelas = conexao.createStatement().executeQuery(
                     "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name IN ('livro', 'exemplar', 'flyway_schema_history')")) {
            if (!tabelas.next() || tabelas.getInt(1) != 3) {
                throw new RegraNegocioException(
                        "O arquivo não é um backup do novo LiBok. Para trazer dados da versão antiga, use \"Importar banco antigo\".");
            }
        } catch (SQLException erro) {
            throw new RegraNegocioException("Não foi possível ler o backup: " + erro.getMessage());
        }
    }

    private static long modificadoEm(Path arquivo) {
        try {
            return Files.getLastModifiedTime(arquivo).toMillis();
        } catch (IOException erro) {
            return 0;
        }
    }
}
