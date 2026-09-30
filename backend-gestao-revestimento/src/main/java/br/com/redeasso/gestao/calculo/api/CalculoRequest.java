package br.com.redeasso.gestao.calculo.api;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CalculoRequest(
        @Size(max = 100) String codigoPiso,
        @Positive Long pisoId,
        @DecimalMin(value = "0", inclusive = false) BigDecimal metragemM2,
        @Positive Long quantidadeCaixas,
        @DecimalMin("0") BigDecimal margemQuebra) {

    @AssertTrue(message = "Informe o código ou o identificador do piso")
    public boolean isPisoInformado() {
        return pisoId != null || (codigoPiso != null && !codigoPiso.isBlank());
    }

    @AssertTrue(message = "Informe a metragem ou a quantidade de caixas, mas não ambas")
    public boolean isQuantidadeInformada() {
        return (metragemM2 == null) != (quantidadeCaixas == null);
    }
}
