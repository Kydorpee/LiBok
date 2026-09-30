package br.com.libok.emprestimos;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;

public class EmprestimoForm {

    @NotNull(message = "Escolha o leitor.")
    private Long leitorId;

    @NotBlank(message = "Informe o código do exemplar.")
    private String codigoExemplar;

    @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
    private LocalDate dataPrevista;

    @Size(max = 500, message = "A observação pode ter no máximo 500 caracteres.")
    private String observacao;

    public Long getLeitorId() {
        return leitorId;
    }

    public void setLeitorId(Long leitorId) {
        this.leitorId = leitorId;
    }

    public String getCodigoExemplar() {
        return codigoExemplar;
    }

    public void setCodigoExemplar(String codigoExemplar) {
        this.codigoExemplar = codigoExemplar;
    }

    public LocalDate getDataPrevista() {
        return dataPrevista;
    }

    public void setDataPrevista(LocalDate dataPrevista) {
        this.dataPrevista = dataPrevista;
    }

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }
}
