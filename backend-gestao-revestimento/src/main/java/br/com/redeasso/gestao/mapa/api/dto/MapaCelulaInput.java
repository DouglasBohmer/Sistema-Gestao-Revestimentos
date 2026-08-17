package br.com.redeasso.gestao.mapa.api.dto;

import java.math.BigDecimal;

public record MapaCelulaInput(
        Long pisoId,
        BigDecimal m2,
        BigDecimal caixas) {
}
