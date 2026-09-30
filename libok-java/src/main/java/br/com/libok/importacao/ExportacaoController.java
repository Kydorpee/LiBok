package br.com.libok.importacao;

import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.OutputStreamWriter;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.LocalDate;
import java.util.function.Consumer;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
@RequestMapping("/exportar")
public class ExportacaoController {

    private final ExportacaoService exportacao;
    private final Clock relogio;

    public ExportacaoController(ExportacaoService exportacao, Clock relogio) {
        this.exportacao = exportacao;
        this.relogio = relogio;
    }

    @GetMapping("/acervo.csv")
    public void acervo(HttpServletResponse resposta) throws IOException {
        enviar(resposta, "acervo", exportacao::acervo);
    }

    @GetMapping("/emprestimos.csv")
    public void emprestimos(HttpServletResponse resposta) throws IOException {
        enviar(resposta, "emprestimos", exportacao::emprestimos);
    }

    @GetMapping("/leitores.csv")
    public void leitores(HttpServletResponse resposta) throws IOException {
        enviar(resposta, "leitores", exportacao::leitores);
    }

    private void enviar(HttpServletResponse resposta, String nome, Consumer<Writer> conteudo) throws IOException {
        String arquivo = "libok-" + nome + "-" + LocalDate.now(relogio) + ".csv";
        resposta.setContentType("text/csv;charset=UTF-8");
        resposta.setHeader(HttpHeaders.CONTENT_DISPOSITION,
                ContentDisposition.attachment().filename(arquivo, StandardCharsets.UTF_8).build().toString());
        Writer escritor = new OutputStreamWriter(resposta.getOutputStream(), StandardCharsets.UTF_8);
        conteudo.accept(escritor);
        escritor.flush();
    }
}
