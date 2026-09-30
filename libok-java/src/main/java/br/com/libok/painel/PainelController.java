package br.com.libok.painel;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import tools.jackson.databind.json.JsonMapper;

@Controller
public class PainelController {

    private final PainelService painel;
    private final JsonMapper json;
    private final Clock relogio;

    public PainelController(PainelService painel, JsonMapper json, Clock relogio) {
        this.painel = painel;
        this.json = json;
        this.relogio = relogio;
    }

    @GetMapping("/")
    public String inicio() {
        return "redirect:/painel";
    }

    @GetMapping("/painel")
    public String painel(@RequestParam(defaultValue = "30") String periodo,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate inicio,
                         @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fim,
                         Model modelo) {
        LocalDate hoje = LocalDate.now(relogio);
        LocalDate fimPeriodo = hoje;
        LocalDate inicioPeriodo = switch (periodo) {
            case "7" -> hoje.minusDays(6);
            case "90" -> hoje.minusDays(89);
            case "ano" -> hoje.withDayOfYear(1);
            case "12m" -> hoje.minusMonths(12).plusDays(1);
            default -> hoje.minusDays(29);
        };
        if ("personalizado".equals(periodo) && inicio != null && fim != null) {
            inicioPeriodo = inicio.isAfter(fim) ? fim : inicio;
            fimPeriodo = inicio.isAfter(fim) ? inicio : fim;
            if (ChronoUnit.DAYS.between(inicioPeriodo, fimPeriodo) > 3660) {
                inicioPeriodo = fimPeriodo.minusYears(10);
            }
        } else if ("personalizado".equals(periodo)) {
            periodo = "30";
        }

        PainelDados dados = painel.dados(inicioPeriodo, fimPeriodo);
        modelo.addAttribute("dados", dados);
        modelo.addAttribute("dadosJson", json.writeValueAsString(dados));
        modelo.addAttribute("periodo", periodo);
        modelo.addAttribute("saudacao", saudacao(LocalTime.now(relogio)));
        modelo.addAttribute("proximas", painel.proximasDevolucoes(6));
        return "painel";
    }

    private static String saudacao(LocalTime agora) {
        int hora = agora.getHour();
        if (hora < 12) {
            return "Bom dia";
        }
        return hora < 18 ? "Boa tarde" : "Boa noite";
    }
}
