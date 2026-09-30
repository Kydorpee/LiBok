package br.com.libok.leitores;

import br.com.libok.comum.RegraNegocioException;
import jakarta.validation.Valid;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/leitores")
public class LeitorController {

    private final LeitorService leitores;

    public LeitorController(LeitorService leitores) {
        this.leitores = leitores;
    }

    @GetMapping
    public String lista(@RequestParam(required = false) String busca,
                        @RequestParam(defaultValue = "false") boolean inativos,
                        @RequestParam(defaultValue = "0") int pagina,
                        @RequestHeader(value = "X-Parcial", required = false) String parcial,
                        Model modelo) {
        modelo.addAttribute("pagina", leitores.buscar(busca, inativos, pagina));
        modelo.addAttribute("busca", busca);
        modelo.addAttribute("inativos", inativos);
        return parcial != null ? "leitores/lista :: resultados" : "leitores/lista";
    }

    @GetMapping("/novo")
    public String novo(Model modelo) {
        modelo.addAttribute("form", new LeitorForm());
        modelo.addAttribute("leitorId", null);
        return "leitores/form";
    }

    @PostMapping
    public String cadastrar(@Valid @ModelAttribute("form") LeitorForm form, BindingResult validacao,
                            Model modelo, RedirectAttributes atributos) {
        return salvar(null, form, validacao, modelo, atributos);
    }

    @GetMapping("/{id}")
    public String detalhe(@PathVariable Long id, Model modelo) {
        modelo.addAttribute("detalhe", leitores.detalhar(id));
        return "leitores/detalhe";
    }

    @GetMapping("/{id}/editar")
    public String editar(@PathVariable Long id, Model modelo) {
        modelo.addAttribute("form", LeitorForm.de(leitores.obter(id)));
        modelo.addAttribute("leitorId", id);
        return "leitores/form";
    }

    @PostMapping("/{id}")
    public String atualizar(@PathVariable Long id, @Valid @ModelAttribute("form") LeitorForm form,
                            BindingResult validacao, Model modelo, RedirectAttributes atributos) {
        return salvar(id, form, validacao, modelo, atributos);
    }

    @PostMapping("/{id}/excluir")
    public String excluir(@PathVariable Long id, RedirectAttributes atributos) {
        atributos.addFlashAttribute("sucesso", leitores.excluir(id));
        return "redirect:/leitores";
    }

    @PostMapping("/{id}/reativar")
    public String reativar(@PathVariable Long id, RedirectAttributes atributos) {
        leitores.reativar(id);
        atributos.addFlashAttribute("sucesso", "Cadastro reativado.");
        return "redirect:/leitores/" + id;
    }

    private String salvar(Long id, LeitorForm form, BindingResult validacao, Model modelo, RedirectAttributes atributos) {
        modelo.addAttribute("leitorId", id);
        if (validacao.hasErrors()) {
            return "leitores/form";
        }
        try {
            Long salvo = leitores.salvar(id, form);
            atributos.addFlashAttribute("sucesso", id == null ? "Leitor cadastrado." : "Alterações salvas.");
            return "redirect:/leitores/" + salvo;
        } catch (RegraNegocioException erro) {
            modelo.addAttribute("erro", erro.getMessage());
            return "leitores/form";
        }
    }
}
