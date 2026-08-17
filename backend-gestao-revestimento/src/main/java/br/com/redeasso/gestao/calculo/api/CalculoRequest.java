package br.com.redeasso.gestao.calculo.api;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;

public record CalculoRequest(
        @NotBlank @Size(max = 100) String codigoPiso,
        @NotNull @DecimalMin(value = "0", inclusive = false) BigDecimal metragemM2,
        @DecimalMin("0") BigDecimal margemQuebra) {
}
