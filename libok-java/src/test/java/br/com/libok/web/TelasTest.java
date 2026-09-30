package br.com.libok.web;

import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.flash;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.model;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.view;

import br.com.libok.TesteIntegracao;
import br.com.libok.emprestimos.EmprestimoForm;
import br.com.libok.emprestimos.EmprestimoService;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;

@AutoConfigureMockMvc
class TelasTest extends TesteIntegracao {

    @Autowired
    MockMvc mvc;

    @Autowired
    EmprestimoService emprestimos;

    @Test
    void todasAsTelasAbremComDados() throws Exception {
        Long livro = cadastrarLivro("Dom Casmurro", "Romance", "R-1", "R-2");
        Long leitor = cadastrarLeitor("Ana Beatriz Souza");
        EmprestimoForm form = new EmprestimoForm();
        form.setLeitorId(leitor);
        form.setCodigoExemplar("R-1");
        emprestimos.emprestar(form);

        String[] telas = {"/painel", "/painel?periodo=7", "/painel?periodo=12m",
                "/painel?periodo=personalizado&inicio=2025-01-01&fim=2026-09-30",
                "/acervo", "/acervo?busca=casmurro", "/acervo/novo", "/acervo/" + livro, "/acervo/" + livro + "/editar",
                "/leitores", "/leitores/novo", "/leitores/" + leitor, "/leitores/" + leitor + "/editar",
                "/emprestimos", "/emprestimos?aba=atrasados", "/emprestimos?aba=historico",
                "/emprestimos/novo?livro=" + livro, "/importacao", "/configuracoes"};
        for (String tela : telas) {
            mvc.perform(get(tela)).andExpect(status().isOk());
        }
        mvc.perform(get("/acervo").param("busca", "dom")).andExpect(content().string(containsString("Dom Casmurro")));
        mvc.perform(get("/painel")).andExpect(content().string(containsString("Ana Beatriz Souza")));
    }

    @Test
    void buscaInstantaneaDevolveSoOsResultados() throws Exception {
        cadastrarLivro("O Pequeno Príncipe", "Infantil", "I-1");
        mvc.perform(get("/acervo").param("busca", "principe").header("X-Parcial", "1"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("O Pequeno Príncipe")))
                .andExpect(content().string(org.hamcrest.Matchers.not(containsString("<aside"))));
    }

    @Test
    void cadastroPeloFormularioComValidacao() throws Exception {
        mvc.perform(post("/acervo").param("titulo", "").param("exemplares[0].codigo", "A"))
                .andExpect(status().isOk())
                .andExpect(view().name("acervo/form"))
                .andExpect(model().attributeHasFieldErrors("form", "titulo", "autor", "categoria", "assunto"));

        mvc.perform(post("/acervo")
                        .param("titulo", "Vidas Secas").param("autor", "Graciliano Ramos")
                        .param("categoria", "Romance").param("assunto", "Seca")
                        .param("exemplares[0].codigo", "VS-1").param("exemplares[1].codigo", "VS-2"))
                .andExpect(redirectedUrl("/acervo/novo"))
                .andExpect(flash().attribute("sucesso", "\"Vidas Secas\" foi cadastrado."));

        mvc.perform(post("/acervo")
                        .param("titulo", "vidas secas").param("autor", "X").param("categoria", "Romance")
                        .param("assunto", "Y").param("exemplares[0].codigo", "Z-1"))
                .andExpect(status().isOk())
                .andExpect(model().attribute("erro", containsString("Já existe um livro")));
    }

    @Test
    void erroDeRegraEmBotaoVoltaComMensagem() throws Exception {
        mvc.perform(post("/emprestimos/devolucao").param("codigo", "NAO-EXISTE").header("Referer", "http://localhost/emprestimos"))
                .andExpect(redirectedUrl("/emprestimos"))
                .andExpect(flash().attribute("erro", containsString("Nenhum exemplar")));
    }

    @Test
    void importacaoCsvPassaPelaPreviaAntesDeGravar() throws Exception {
        MockHttpSession sessao = new MockHttpSession();
        String csv = "Nome do livro;Autor;Categoria;Assunto;Codigos de registro\nLivro CSV;Autor;Romance;Assunto;C-1\n";
        mvc.perform(multipart("/importacao/csv")
                        .file(new MockMultipartFile("arquivo", "acervo.csv", "text/csv", csv.getBytes(StandardCharsets.UTF_8)))
                        .session(sessao))
                .andExpect(redirectedUrl("/importacao/previa"));
        mvc.perform(get("/importacao/previa").session(sessao))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("Livro CSV")));
        mvc.perform(post("/importacao/confirmar").session(sessao))
                .andExpect(status().is3xxRedirection());
        mvc.perform(get("/acervo")).andExpect(content().string(containsString("Livro CSV")));
    }

    @Test
    void exportaCsvComBomEPontoEVirgula() throws Exception {
        cadastrarLivro("Livro Exportado", "Romance", "E-1");
        mvc.perform(get("/exportar/acervo.csv"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("libok-acervo-2026-09-30.csv")))
                .andExpect(content().string(containsString("Livro Exportado;Autor de Livro Exportado;Romance")));
    }

    @Test
    void recusaEnvioDeOutroSiteEAcessoPorOutroEndereco() throws Exception {
        Long livro = cadastrarLivro("Livro Protegido", "Romance", "P-1");
        mvc.perform(post("/acervo/" + livro + "/excluir").header("Origin", "https://site-malicioso.com"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/painel").header("Host", "libok.exemplo.com"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/acervo/" + livro + "/excluir").header("Origin", "http://localhost"))
                .andExpect(redirectedUrl("/acervo"));
    }

    @Test
    void paginaInexistenteMostraAviso() throws Exception {
        mvc.perform(get("/acervo/999999")).andExpect(status().isNotFound())
                .andExpect(content().string(containsString("Livro não encontrado")));
    }
}
