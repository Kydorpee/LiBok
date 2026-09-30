package br.com.libok.web;

import br.com.libok.comum.RecursoNaoEncontradoException;
import br.com.libok.comum.RegraNegocioException;
import br.com.libok.configuracao.ConfiguracaoService;
import br.com.libok.emprestimos.EmprestimoService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.net.URI;
import java.time.Clock;
import java.time.LocalDate;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/** Dados presentes em todas as telas e tratamento de erros comum. */
@ControllerAdvice
public class ModeloGlobal {

    private final ConfiguracaoService configuracoes;
    private final EmprestimoService emprestimos;
    private final Clock relogio;

    public ModeloGlobal(ConfiguracaoService configuracoes, EmprestimoService emprestimos, Clock relogio) {
        this.configuracoes = configuracoes;
        this.emprestimos = emprestimos;
        this.relogio = relogio;
    }

    @ModelAttribute
    public void dadosComuns(Model modelo, HttpServletRequest requisicao) {
        if (modelo.containsAttribute("nomeBiblioteca")) {
            return;
        }
        modelo.addAttribute("nomeBiblioteca", configuracoes.atual().getNomeBiblioteca());
        modelo.addAttribute("totalAtrasados", emprestimos.totalAtrasados());
        modelo.addAttribute("hoje", LocalDate.now(relogio));
        modelo.addAttribute("secao", secao(requisicao.getRequestURI()));
    }

    private static String secao(String caminho) {
        if (caminho.startsWith("/acervo/novo")) {
            return "cadastro";
        }
        for (String secao : new String[] {"acervo", "emprestimos", "leitores", "importacao", "configuracoes"}) {
            if (caminho.startsWith("/" + secao)) {
                return secao;
            }
        }
        return "painel";
    }

    @ExceptionHandler(RecursoNaoEncontradoException.class)
    public String naoEncontrado(RecursoNaoEncontradoException erro, Model modelo, HttpServletRequest requisicao,
                                HttpServletResponse resposta) {
        resposta.setStatus(HttpServletResponse.SC_NOT_FOUND);
        dadosComuns(modelo, requisicao);
        modelo.addAttribute("mensagem", erro.getMessage());
        return "erro";
    }

    /** Erros de regra em ações simples (botões): volta para a tela anterior com a mensagem. */
    @ExceptionHandler(RegraNegocioException.class)
    public String regraNegocio(RegraNegocioException erro, HttpServletRequest requisicao, RedirectAttributes atributos) {
        atributos.addFlashAttribute("erro", erro.getMessage());
        return "redirect:" + voltar(requisicao);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public String integridade(HttpServletRequest requisicao, RedirectAttributes atributos) {
        atributos.addFlashAttribute("erro", "Não foi possível salvar: algum dado já está em uso. Confira os códigos e tente novamente.");
        return "redirect:" + voltar(requisicao);
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public String arquivoGrande(HttpServletRequest requisicao, RedirectAttributes atributos) {
        atributos.addFlashAttribute("erro", "O arquivo é grande demais (limite de 50 MB).");
        return "redirect:" + voltar(requisicao);
    }

    private static String voltar(HttpServletRequest requisicao) {
        String anterior = requisicao.getHeader("Referer");
        if (anterior != null) {
            try {
                URI uri = URI.create(anterior);
                String caminho = uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
                if (caminho.startsWith("/")) {
                    return caminho;
                }
            } catch (IllegalArgumentException ignorado) {
                // cai no painel
            }
        }
        return "/painel";
    }
}
