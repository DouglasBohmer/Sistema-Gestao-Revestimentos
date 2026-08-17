package br.com.redeasso.gestao.catalogo.domain;

import java.math.BigDecimal;

public record DadosPiso(
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
        BigDecimal valor) {
}
