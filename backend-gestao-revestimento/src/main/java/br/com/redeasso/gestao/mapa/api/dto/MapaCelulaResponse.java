package br.com.redeasso.gestao.mapa.api.dto;

import java.math.BigDecimal;

public record MapaCelulaResponse(
        Long pisoId,
        BigDecimal m2,
        int caixas) {
}
