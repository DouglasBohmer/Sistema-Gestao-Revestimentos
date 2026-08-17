package br.com.redeasso.gestao.mapa.api.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record MapaResponse(
        Long id,
        String nome,
        int linhas,
        int colunas,
        MapaLabelsResponse labels,
        Map<String, List<MapaCelulaResponse>> celulas,
        Instant createdAt,
        Instant updatedAt) {
}
