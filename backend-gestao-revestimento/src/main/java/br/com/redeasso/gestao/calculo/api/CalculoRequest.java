package br.com.redeasso.gestao.calculo.api;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record CalculoRequest(
        @Size(max = 100) String codigoPiso,
        @Positive Long pisoId,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal metragemM2,
        @DecimalMin("0") BigDecimal margemQuebra) {

    @AssertTrue(message = "Informe o código ou o identificador do piso")
    public boolean isPisoInformado() {
        return pisoId != null || (codigoPiso != null && !codigoPiso.isBlank());
    }
}
