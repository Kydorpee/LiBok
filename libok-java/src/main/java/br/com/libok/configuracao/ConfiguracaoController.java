package br.com.libok.configuracao;

import jakarta.validation.Valid;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/configuracoes")
public class ConfiguracaoController {

    private final ConfiguracaoService configuracoes;
    private final BackupService backups;
    private final ApplicationContext contexto;

    public ConfiguracaoController(ConfiguracaoService configuracoes, BackupService backups, ApplicationContext contexto) {
        this.configuracoes = configuracoes;
        this.backups = backups;
        this.contexto = contexto;
    }

    public record ArquivoBackup(String nome, LocalDateTime criadoEm, long tamanhoKb) {
    }

    @GetMapping
    public String pagina(Model modelo) {
        modelo.addAttribute("form", ConfiguracaoForm.de(configuracoes.atual()));
        return exibir(modelo);
    }

    @PostMapping
    public String salvar(@Valid @ModelAttribute("form") ConfiguracaoForm form, BindingResult validacao,
                         Model modelo, RedirectAttributes atributos) {
        if (validacao.hasErrors()) {
            return exibir(modelo);
        }
        configuracoes.salvar(form);
        atributos.addFlashAttribute("sucesso", "Configurações salvas.");
        return "redirect:/configuracoes";
    }

    @PostMapping("/backup")
    public String gerarBackup(RedirectAttributes atributos) {
        Path arquivo = backups.gerarBackup();
        atributos.addFlashAttribute("sucesso", "Backup criado: " + arquivo.getFileName() + ".");
        return "redirect:/configuracoes#backups";
    }

    @GetMapping("/backups/{nome}")
    public ResponseEntity<Resource> baixarBackup(@PathVariable String nome) {
        Path arquivo = backups.arquivoDeBackup(nome);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(arquivo.getFileName().toString()).build().toString())
                .body(new FileSystemResource(arquivo));
    }

    @PostMapping("/backups/{nome}/restaurar")
    public String restaurarBackup(@PathVariable String nome, RedirectAttributes atributos) {
        backups.agendarRestauracao(nome);
        atributos.addFlashAttribute("sucesso", "Restauração agendada. Feche e abra o LiBok para concluir.");
        return "redirect:/configuracoes#backups";
    }

    @PostMapping("/restaurar")
    public String restaurarArquivo(@RequestParam("arquivo") MultipartFile arquivo, RedirectAttributes atributos)
            throws IOException {
        if (arquivo.isEmpty()) {
            atributos.addFlashAttribute("erro", "Escolha um arquivo de backup (.db).");
            return "redirect:/configuracoes#backups";
        }
        backups.agendarRestauracao(arquivo.getInputStream());
        atributos.addFlashAttribute("sucesso", "Restauração agendada. Feche e abra o LiBok para concluir.");
        return "redirect:/configuracoes#backups";
    }

    @PostMapping("/restauracao/cancelar")
    public String cancelarRestauracao(RedirectAttributes atributos) {
        backups.cancelarRestauracao();
        atributos.addFlashAttribute("sucesso", "Restauração cancelada.");
        return "redirect:/configuracoes#backups";
    }

    /** Encerra o programa (usado após agendar uma restauração). */
    @PostMapping("/encerrar")
    public String encerrar() {
        Thread encerramento = new Thread(() -> {
            try {
                Thread.sleep(800);
            } catch (InterruptedException ignorado) {
                Thread.currentThread().interrupt();
            }
            System.exit(SpringApplication.exit(contexto, () -> 0));
        });
        encerramento.setDaemon(false);
        encerramento.start();
        return "encerrado";
    }

    private String exibir(Model modelo) {
        List<ArquivoBackup> lista = backups.listar().stream().map(ConfiguracaoController::descrever).toList();
        modelo.addAttribute("backups", lista);
        modelo.addAttribute("pastaDados", backups.pastaDados().toString());
        modelo.addAttribute("restauracaoAgendada", backups.restauracaoAgendada());
        return "configuracoes";
    }

    private static ArquivoBackup descrever(Path arquivo) {
        try {
            Instant modificado = Files.getLastModifiedTime(arquivo).toInstant();
            return new ArquivoBackup(arquivo.getFileName().toString(),
                    LocalDateTime.ofInstant(modificado, ZoneId.systemDefault()), Math.max(1, Files.size(arquivo) / 1024));
        } catch (IOException erro) {
            return new ArquivoBackup(arquivo.getFileName().toString(), null, 0);
        }
    }
}
