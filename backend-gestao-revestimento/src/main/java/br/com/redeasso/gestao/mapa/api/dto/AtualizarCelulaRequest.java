package br.com.redeasso.gestao.mapa.api.dto;

import java.math.BigDecimal;
import java.util.List;

public record AtualizarCelulaRequest(
        List<MapaCelulaInput> pisos,
        Long pisoId,
        BigDecimal m2,
        BigDecimal caixas) {

    public List<MapaCelulaInput> itens() {
        if (pisos != null) {
            return pisos;
        }
        return List.of(new MapaCelulaInput(pisoId, m2, caixas));
    }
}
