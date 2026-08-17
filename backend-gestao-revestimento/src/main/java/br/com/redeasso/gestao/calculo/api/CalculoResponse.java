package br.com.redeasso.gestao.calculo.api;

import br.com.redeasso.gestao.catalogo.api.PisoResponse;

import java.math.BigDecimal;

public record CalculoResponse(
        PisoResponse piso,
        BigDecimal metragemM2,
        BigDecimal margemQuebra,
        BigDecimal metragemComMargem,
        long quantidadeCaixas,
        BigDecimal valorTotal) {
}
