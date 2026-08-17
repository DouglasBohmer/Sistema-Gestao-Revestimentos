package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.domain.Piso;

import java.math.BigDecimal;
import java.time.Instant;

public record PisoResponse(
        Long id,
        String nome,
        String codigoRede,
        String codigoLoja,
        BigDecimal largura,
        BigDecimal altura,
        BigDecimal rejunte,
        BigDecimal pecasPorCaixa,
        BigDecimal m2PorCaixa,
        String localDeUso,
        String tipoPiso,
        Integer pei,
        Boolean retificado,
        String linkSite,
        String linkFoto,
        BigDecimal valor,
        Instant createdAt,
        Instant updatedAt) {

    public static PisoResponse from(Piso piso) {
        return new PisoResponse(
                piso.getId(),
                piso.getNome(),
                piso.getCodigoRede(),
                piso.getCodigoLoja(),
                piso.getLargura(),
                piso.getAltura(),
                piso.getRejunte(),
                piso.getPecasPorCaixa(),
                piso.getM2PorCaixa(),
                piso.getLocalDeUso(),
                piso.getTipoPiso(),
                piso.getPei(),
                piso.getRetificado(),
                piso.getLinkSite(),
                piso.getLinkFoto(),
                piso.getValor(),
                piso.getCreatedAt(),
                piso.getUpdatedAt());
    }
}
