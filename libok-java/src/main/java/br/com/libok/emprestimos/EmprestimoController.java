package br.com.libok.emprestimos;

import br.com.libok.comum.RegraNegocioException;
import br.com.libok.leitores.LeitorService;
import jakarta.validation.Valid;
import java.time.format.DateTimeFormatter;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/emprestimos")
public class EmprestimoController {

    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final EmprestimoService emprestimos;
    private final LeitorService leitores;

    public EmprestimoController(EmprestimoService emprestimos, LeitorService leitores) {
        this.emprestimos = emprestimos;
        this.leitores = leitores;
    }

    @GetMapping
    public String lista(@RequestParam(defaultValue = "ativos") String aba,
                        @RequestParam(defaultValue = "0") int pagina, Model modelo) {
        modelo.addAttribute("aba", aba);
        switch (aba) {
            case "atrasados" -> modelo.addAttribute("lista", emprestimos.atrasados());
            case "historico" -> modelo.addAttribute("paginaHistorico", emprestimos.devolvidos(pagina));
            default -> {
                modelo.addAttribute("aba", "ativos");
                modelo.addAttribute("lista", emprestimos.ativos());
            }
        }
        return "emprestimos/lista";
    }

    @GetMapping("/novo")
    public String novo(@RequestParam(required = false) String codigo,
                       @RequestParam(required = false) Long leitor,
                       @RequestParam(required = false) Long livro, Model modelo) {
        EmprestimoForm form = new EmprestimoForm();
        form.setCodigoExemplar(codigo != null ? codigo : emprestimos.primeiroCodigoDisponivel(livro));
        form.setLeitorId(leitor);
        form.setDataPrevista(emprestimos.dataPrevistaPadrao());
        modelo.addAttribute("form", form);
        return formulario(modelo);
    }

    @PostMapping
    public String emprestar(@Valid @ModelAttribute("form") EmprestimoForm form, BindingResult validacao,
                            Model modelo, RedirectAttributes atributos) {
        if (validacao.hasErrors()) {
            return formulario(modelo);
        }
        try {
            Emprestimo emprestimo = emprestimos.emprestar(form);
            atributos.addFlashAttribute("sucesso", "\"" + emprestimo.getExemplar().getLivro().getTitulo()
                    + "\" emprestado para " + emprestimo.getLeitor().getNome()
                    + ". Devolução até " + emprestimo.getDataPrevista().format(DATA) + ".");
            return "redirect:/emprestimos";
        } catch (RegraNegocioException erro) {
            modelo.addAttribute("erro", erro.getMessage());
            return formulario(modelo);
        }
    }

    @PostMapping("/{id}/devolver")
    public String devolver(@PathVariable Long id, RedirectAttributes atributos) {
        Emprestimo emprestimo = emprestimos.devolver(id);
        atributos.addFlashAttribute("sucesso", mensagemDevolucao(emprestimo));
        return "redirect:/emprestimos";
    }

    @PostMapping("/devolucao")
    public String devolverPorCodigo(@RequestParam String codigo, RedirectAttributes atributos) {
        Emprestimo emprestimo = emprestimos.devolverPorCodigo(codigo);
        atributos.addFlashAttribute("sucesso", mensagemDevolucao(emprestimo));
        return "redirect:/emprestimos";
    }

    @PostMapping("/{id}/renovar")
    public String renovar(@PathVariable Long id, RedirectAttributes atributos) {
        Emprestimo emprestimo = emprestimos.renovar(id);
        atributos.addFlashAttribute("sucesso", "Empréstimo renovado até " + emprestimo.getDataPrevista().format(DATA) + ".");
        return "redirect:/emprestimos";
    }

    private static String mensagemDevolucao(Emprestimo emprestimo) {
        String mensagem = "Devolução de \"" + emprestimo.getExemplar().getLivro().getTitulo() + "\" registrada";
        long atraso = emprestimo.diasAtraso(emprestimo.getDataDevolucao());
        return atraso > 0 ? mensagem + " (" + atraso + " dia(s) de atraso)." : mensagem + ".";
    }

    private String formulario(Model modelo) {
        modelo.addAttribute("leitores", leitores.ativos());
        modelo.addAttribute("disponiveis", emprestimos.exemplaresDisponiveis());
        return "emprestimos/form";
    }
}
