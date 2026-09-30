package br.com.libok.acervo;

import br.com.libok.comum.RegraNegocioException;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.validation.BindingResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

@Controller
@RequestMapping("/acervo")
public class LivroController {

    private final LivroService livros;
    private final CategoriaService categorias;

    public LivroController(LivroService livros, CategoriaService categorias) {
        this.livros = livros;
        this.categorias = categorias;
    }

    /** Lista do acervo. Com o cabeçalho X-Parcial devolve só os resultados, para a busca instantânea. */
    @GetMapping
    public String lista(@ModelAttribute("filtro") FiltroAcervo filtro, Model modelo,
                        @RequestHeader(value = "X-Parcial", required = false) String parcial) {
        Page<LivroResumo> pagina = livros.buscar(filtro);
        modelo.addAttribute("pagina", pagina);
        modelo.addAttribute("categorias", categorias.emUso());
        return parcial != null ? "acervo/lista :: resultados" : "acervo/lista";
    }

    @GetMapping("/novo")
    public String novo(Model modelo) {
        modelo.addAttribute("form", LivroForm.novo());
        return formulario(modelo, null);
    }

    @PostMapping
    public String cadastrar(@Valid @ModelAttribute("form") LivroForm form, BindingResult validacao,
                            Model modelo, RedirectAttributes atributos) {
        if (validacao.hasErrors()) {
            return formulario(modelo, null);
        }
        try {
            Long id = livros.salvar(null, form);
            atributos.addFlashAttribute("sucesso", "\"" + form.getTitulo().strip() + "\" foi cadastrado.");
            atributos.addFlashAttribute("livroCadastradoId", id);
            return "redirect:/acervo/novo";
        } catch (RegraNegocioException erro) {
            modelo.addAttribute("erro", erro.getMessage());
            return formulario(modelo, null);
        }
    }

    @GetMapping("/{id}")
    public String detalhe(@PathVariable Long id, Model modelo) {
        modelo.addAttribute("detalhe", livros.detalhar(id));
        return "acervo/detalhe";
    }

    @GetMapping("/{id}/editar")
    public String editar(@PathVariable Long id, Model modelo) {
        modelo.addAttribute("form", livros.formulario(id));
        return formulario(modelo, id);
    }

    @PostMapping("/{id}")
    public String atualizar(@PathVariable Long id, @Valid @ModelAttribute("form") LivroForm form,
                            BindingResult validacao, Model modelo, RedirectAttributes atributos) {
        if (validacao.hasErrors()) {
            return formulario(modelo, id);
        }
        try {
            livros.salvar(id, form);
            atributos.addFlashAttribute("sucesso", "Alterações salvas.");
            return "redirect:/acervo/" + id;
        } catch (RegraNegocioException erro) {
            modelo.addAttribute("erro", erro.getMessage());
            return formulario(modelo, id);
        }
    }

    @PostMapping("/{id}/excluir")
    public String excluir(@PathVariable Long id, RedirectAttributes atributos) {
        String titulo = livros.excluir(id);
        atributos.addFlashAttribute("sucesso", "\"" + titulo + "\" foi excluído do acervo.");
        return "redirect:/acervo";
    }

    @PostMapping("/exemplares/{id}/baixar")
    public String baixar(@PathVariable Long id, RedirectAttributes atributos) {
        Long livroId = livros.baixarExemplar(id);
        atributos.addFlashAttribute("sucesso", "Exemplar baixado. Ele continua no histórico, mas não pode mais ser emprestado.");
        return "redirect:/acervo/" + livroId;
    }

    @PostMapping("/exemplares/{id}/reativar")
    public String reativar(@PathVariable Long id, RedirectAttributes atributos) {
        Long livroId = livros.reativarExemplar(id);
        atributos.addFlashAttribute("sucesso", "Exemplar reativado.");
        return "redirect:/acervo/" + livroId;
    }

    private String formulario(Model modelo, Long id) {
        modelo.addAttribute("livroId", id);
        modelo.addAttribute("categorias", categorias.todas());
        if (id != null) {
            modelo.addAttribute("tituloOriginal", livros.titulo(id));
        }
        return "acervo/form";
    }
}
