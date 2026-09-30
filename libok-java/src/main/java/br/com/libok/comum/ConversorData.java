package br.com.libok.comum;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.time.LocalDate;

/** Grava datas como texto ISO (2026-09-30) no SQLite, o que mantém a ordenação e a legibilidade. */
@Converter(autoApply = true)
public class ConversorData implements AttributeConverter<LocalDate, String> {

    @Override
    public String convertToDatabaseColumn(LocalDate data) {
        return data == null ? null : data.toString();
    }

    @Override
    public LocalDate convertToEntityAttribute(String texto) {
        return texto == null || texto.isBlank() ? null : LocalDate.parse(texto);
    }
}
