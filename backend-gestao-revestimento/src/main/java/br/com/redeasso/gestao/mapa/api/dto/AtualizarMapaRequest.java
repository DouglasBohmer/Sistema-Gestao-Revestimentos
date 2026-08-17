package br.com.redeasso.gestao.mapa.api.dto;

public record AtualizarMapaRequest(
        String nome,
        MapaLabelsRequest labels) {
}
