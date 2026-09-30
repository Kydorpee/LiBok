package br.com.libok.configuracao;

import br.com.libok.comum.Textos;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ConfiguracaoService {

    private final ConfiguracaoRepository repositorio;

    public ConfiguracaoService(ConfiguracaoRepository repositorio) {
        this.repositorio = repositorio;
    }

    @Transactional(readOnly = true)
    public Configuracao atual() {
        return repositorio.findById(1L).orElseThrow();
    }

    @Transactional
    public void salvar(ConfiguracaoForm form) {
        Configuracao configuracao = repositorio.findById(1L).orElseThrow();
        configuracao.setNomeBiblioteca(Textos.limpar(form.getNomeBiblioteca()));
        configuracao.setPrazoEmprestimoDias(form.getPrazoEmprestimoDias());
        configuracao.setLimiteEmprestimos(form.getLimiteEmprestimos());
        configuracao.setBloquearComAtraso(form.isBloquearComAtraso());
    }
}
