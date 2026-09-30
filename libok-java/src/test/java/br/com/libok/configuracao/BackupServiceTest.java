package br.com.libok.configuracao;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import br.com.libok.TesteIntegracao;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;

class BackupServiceTest extends TesteIntegracao {

    @Autowired
    BackupService backups;

    @Test
    void geraBackupConsistenteEAgendaRestauracao() throws Exception {
        cadastrarLivro("Livro do backup", "Romance", "B-1");

        Path arquivo = backups.gerarBackup();

        assertThat(arquivo).exists();
        assertThat(backups.listar()).contains(arquivo);
        backups.agendarRestauracao(arquivo.getFileName().toString());
        assertThat(backups.restauracaoAgendada()).isTrue();
        backups.cancelarRestauracao();
        assertThat(backups.restauracaoAgendada()).isFalse();
    }

    @Test
    void recusaArquivoQueNaoEhBackup() {
        assertThatThrownBy(() -> backups.agendarRestauracao(
                new ByteArrayInputStream("qualquer coisa".getBytes(StandardCharsets.UTF_8))))
                .hasMessageContaining("não é um backup");
        assertThat(backups.restauracaoAgendada()).isFalse();
    }

    @Test
    void naoPermiteSairDaPastaDeBackups() {
        assertThatThrownBy(() -> backups.arquivoDeBackup("../libok.db")).hasMessageContaining("não encontrado");
    }

    @Test
    void restauracaoPendenteTrocaOBancoEGuardaOAnterior(@TempDir Path pasta) throws Exception {
        Files.writeString(pasta.resolve("libok.db"), "atual");
        Files.writeString(pasta.resolve("libok.db-wal"), "wal");
        Files.writeString(pasta.resolve("libok.db.restaurar"), "backup");

        assertThat(RestauracaoPendente.aplicar(pasta)).isTrue();

        assertThat(Files.readString(pasta.resolve("libok.db"))).isEqualTo("backup");
        assertThat(pasta.resolve("libok.db-wal")).doesNotExist();
        try (var arquivos = Files.list(pasta.resolve("backups"))) {
            assertThat(arquivos.map(p -> p.getFileName().toString()))
                    .anyMatch(nome -> nome.startsWith("antes-da-restauracao-") && nome.endsWith(".db"));
        }
        assertThat(RestauracaoPendente.aplicar(pasta)).isFalse();
    }
}
