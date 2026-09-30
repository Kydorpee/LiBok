package br.com.libok.web;

import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.LocaleResolver;
import org.springframework.web.servlet.i18n.FixedLocaleResolver;

@Configuration
public class ConfiguracaoWeb {

    public static final Locale PT_BR = Locale.of("pt", "BR");

    /** Datas e números sempre no padrão brasileiro, independente do idioma do navegador. */
    @Bean
    public LocaleResolver localeResolver() {
        return new FixedLocaleResolver(PT_BR);
    }
}
