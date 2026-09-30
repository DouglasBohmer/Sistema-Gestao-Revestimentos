package br.com.redeasso.gestao.calculo.api;

import br.com.redeasso.gestao.catalogo.api.PisoResponse;

import java.math.BigDecimal;

public record CalculoResponse(
        PisoResponse piso,
        BigDecimal metragemM2,
        BigDecimal margemQuebra,
        BigDecimal metragemComMargem,
        long quantidadeCaixas,
        BigDecimal metragemVendidaM2,
        long quantidadeSacosArgamassa,
        BigDecimal pesoArgamassaKg,
        Long quantidadeEmbalagensRejunte,
        BigDecimal pesoRejunteKg,
        Long niveladoresLadoX,
        Long niveladoresLadoY,
        Long quantidadeNiveladores,
        Long quantidadePacotesNiveladores,
        BigDecimal valorTotal) {
}
