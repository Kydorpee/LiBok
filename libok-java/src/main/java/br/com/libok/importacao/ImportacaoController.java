package br.com.libok.importacao;

import br.com.libok.comum.RegraNegocioException;
import br.com.libok.desktop.PastaDados;
import jakarta.servlet.http.HttpSession;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/importacao")
public class ImportacaoController {

    private static final String PENDENTE = "importacaoPendente";

    private final ImportacaoService importacoes;
    private final LeitorCsv leitorCsv;
    private final LeitorBancoLegado leitorLegado;

    public ImportacaoController(ImportacaoService importacoes, LeitorCsv leitorCsv, LeitorBancoLegado leitorLegado) {
        this.importacoes = importacoes;
        this.leitorCsv = leitorCsv;
        this.leitorLegado = leitorLegado;
    }

    @GetMapping
    public String inicio(Model modelo) {
        modelo.addAttribute("historico", importacoes.recentes());
        modelo.addAttribute("bancoAntigo", PastaDados.bancoDaVersaoAntiga().map(Path::toString).orElse(null));
        return "importacao/inicio";
    }

    /** Lê o banco do LiBok antigo encontrado neste computador, sem precisar procurar o arquivo. */
    @PostMapping("/legado-local")
    public String importarBancoAntigoLocal(HttpSession sessao) {
        Path antigo = PastaDados.bancoDaVersaoAntiga()
                .orElseThrow(() -> new RegraNegocioException("O banco do LiBok antigo não foi encontrado neste computador."));
        LeituraArquivo leitura = leitorLegado.ler(antigo);
        sessao.setAttribute(PENDENTE, new ImportacaoPendente(antigo.toString(), "LiBok antigo", leitura));
        return "redirect:/importacao/previa";
    }

    /** Lê e valida o CSV; nada é gravado até o usuário confirmar na prévia. */
    @PostMapping("/csv")
    public String enviarCsv(@RequestParam("arquivo") MultipartFile arquivo, HttpSession sessao,
                            RedirectAttributes atributos) throws IOException {
        if (arquivo.isEmpty()) {
            atributos.addFlashAttribute("erro", "Escolha um arquivo CSV.");
            return "redirect:/importacao";
        }
        LeituraArquivo leitura = leitorCsv.ler(arquivo.getBytes());
        sessao.setAttribute(PENDENTE, new ImportacaoPendente(nome(arquivo, "planilha.csv"), "CSV", leitura));
        return "redirect:/importacao/previa";
    }

    @PostMapping("/legado")
    public String enviarBancoAntigo(@RequestParam("arquivo") MultipartFile arquivo, HttpSession sessao,
                                    RedirectAttributes atributos) {
        if (arquivo.isEmpty()) {
            atributos.addFlashAttribute("erro", "Escolha o arquivo libok.db da versão anterior.");
            return "redirect:/importacao";
        }
        Path temporario = null;
        try {
            temporario = Files.createTempFile("libok-legado-", ".db");
            arquivo.transferTo(temporario);
            LeituraArquivo leitura = leitorLegado.ler(temporario);
            sessao.setAttribute(PENDENTE, new ImportacaoPendente(nome(arquivo, "libok.db"), "LiBok antigo", leitura));
            return "redirect:/importacao/previa";
        } catch (IOException erro) {
            throw new UncheckedIOException(erro);
        } finally {
            apagar(temporario);
        }
    }

    @GetMapping("/previa")
    public String previa(HttpSession sessao, Model modelo) {
        ImportacaoPendente pendente = (ImportacaoPendente) sessao.getAttribute(PENDENTE);
        if (pendente == null) {
            return "redirect:/importacao";
        }
        modelo.addAttribute("pendente", pendente);
        modelo.addAttribute("analise", importacoes.analisar(pendente.leitura()));
        return "importacao/previa";
    }

    @PostMapping("/confirmar")
    public String confirmar(HttpSession sessao, RedirectAttributes atributos) {
        ImportacaoPendente pendente = (ImportacaoPendente) sessao.getAttribute(PENDENTE);
        if (pendente == null) {
            throw new RegraNegocioException("Nenhuma importação pendente. Envie o arquivo novamente.");
        }
        sessao.removeAttribute(PENDENTE);
        Importacao resultado = importacoes.importar(pendente);
        atributos.addFlashAttribute(resultado.isSucessoTotal() ? "sucesso" : "erro", resultado.getLog().lines().findFirst().orElse(""));
        return "redirect:/importacao/" + resultado.getId();
    }

    @PostMapping("/cancelar")
    public String cancelar(HttpSession sessao) {
        sessao.removeAttribute(PENDENTE);
        return "redirect:/importacao";
    }

    @GetMapping("/{id}")
    public String log(@PathVariable Long id, Model modelo) {
        modelo.addAttribute("importacao", importacoes.obter(id));
        return "importacao/log";
    }

    private static String nome(MultipartFile arquivo, String padrao) {
        String original = arquivo.getOriginalFilename();
        return original == null || original.isBlank() ? padrao : Path.of(original).getFileName().toString();
    }

    private static void apagar(Path arquivo) {
        if (arquivo == null) {
            return;
        }
        try {
            Files.deleteIfExists(arquivo);
        } catch (IOException ignorado) {
            arquivo.toFile().deleteOnExit();
        }
    }
}
