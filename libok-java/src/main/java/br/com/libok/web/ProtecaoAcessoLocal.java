package br.com.libok.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import java.util.Set;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * O LiBok só escuta em 127.0.0.1, mas o navegador pode ser induzido por outro site a enviar
 * requisições para ele. Este filtro recusa endereços que não sejam locais (DNS rebinding) e
 * envios de formulário vindos de outras origens (CSRF).
 */
@Component
public class ProtecaoAcessoLocal extends OncePerRequestFilter {

    private static final Set<String> HOSTS_LOCAIS = Set.of("localhost", "127.0.0.1", "[::1]");
    private static final Set<String> METODOS_SEGUROS = Set.of("GET", "HEAD", "OPTIONS");

    @Override
    protected void doFilterInternal(HttpServletRequest requisicao, HttpServletResponse resposta, FilterChain cadeia)
            throws ServletException, IOException {
        if (!HOSTS_LOCAIS.contains(requisicao.getServerName())) {
            resposta.sendError(HttpServletResponse.SC_FORBIDDEN, "Acesso permitido apenas pelo próprio computador.");
            return;
        }
        if (!METODOS_SEGUROS.contains(requisicao.getMethod()) && !origemLocal(requisicao)) {
            resposta.sendError(HttpServletResponse.SC_FORBIDDEN, "Envio recusado: origem desconhecida.");
            return;
        }
        cadeia.doFilter(requisicao, resposta);
    }

    private static boolean origemLocal(HttpServletRequest requisicao) {
        String origem = requisicao.getHeader("Origin");
        if (origem == null || origem.isBlank()) {
            origem = requisicao.getHeader("Referer");
        }
        if (origem == null || origem.isBlank()) {
            // Sem Origin nem Referer (clientes que não são navegador): permitido.
            return true;
        }
        try {
            URI uri = URI.create(origem);
            int porta = uri.getPort() != -1 ? uri.getPort() : ("https".equals(uri.getScheme()) ? 443 : 80);
            return uri.getHost() != null
                    && HOSTS_LOCAIS.contains(uri.getHost().contains(":") ? "[" + uri.getHost() + "]" : uri.getHost())
                    && porta == requisicao.getServerPort();
        } catch (IllegalArgumentException erro) {
            return false;
        }
    }
}
