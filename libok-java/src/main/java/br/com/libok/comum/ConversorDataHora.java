package br.com.libok.comum;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.time.LocalDateTime;

@Converter(autoApply = true)
public class ConversorDataHora implements AttributeConverter<LocalDateTime, String> {

    @Override
    public String convertToDatabaseColumn(LocalDateTime dataHora) {
        return dataHora == null ? null : dataHora.withNano(0).toString();
    }

    @Override
    public LocalDateTime convertToEntityAttribute(String texto) {
        return texto == null || texto.isBlank() ? null : LocalDateTime.parse(texto);
    }
}
