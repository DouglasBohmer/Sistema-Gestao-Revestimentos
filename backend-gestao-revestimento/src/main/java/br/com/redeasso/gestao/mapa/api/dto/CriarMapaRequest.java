package br.com.redeasso.gestao.mapa.api.dto;

public record CriarMapaRequest(
        String nome,
        Integer linhas,
        Integer colunas,
        MapaLabelsRequest labels) {
}
