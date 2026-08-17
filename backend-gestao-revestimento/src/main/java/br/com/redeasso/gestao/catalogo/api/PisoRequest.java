package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record PisoRequest(
        @NotBlank @Size(max = 200) String nome,
        @Size(max = 100) String codigoRede,
        @NotBlank @Size(max = 100) String codigoLoja,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 6) BigDecimal largura,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 6) BigDecimal altura,
        @DecimalMin("0") @Digits(integer = 12, fraction = 6) BigDecimal rejunte,
        @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 6) BigDecimal pecasPorCaixa,
        @NotNull @DecimalMin(value = "0", inclusive = false) @Digits(integer = 12, fraction = 6) BigDecimal m2PorCaixa,
        @Size(max = 100) String localDeUso,
        @Size(max = 100) String tipoPiso,
        @Min(1) @Max(5) Integer pei,
        Boolean retificado,
        @Size(max = 2048) String linkSite,
        @Size(max = 2048) String linkFoto,
        @DecimalMin("0") @Digits(integer = 12, fraction = 6) BigDecimal valor) {

    DadosPiso toDadosPiso() {
        return new DadosPiso(
                nome,
                codigoRede,
                codigoLoja,
                largura,
                altura,
                rejunte,
                pecasPorCaixa,
                m2PorCaixa,
                localDeUso,
                tipoPiso,
                pei,
                retificado,
                linkSite,
                linkFoto,
                valor);
    }
}
