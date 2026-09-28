package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import br.com.redeasso.gestao.catalogo.domain.ClassificacaoUso;
import br.com.redeasso.gestao.catalogo.domain.OrigemDadoProduto;

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
        ClassificacaoUso classificacaoUso,
        AcabamentoBorda acabamentoBordas,
        String linkSite,
        String linkFoto,
        String linkFotoOrigem,
        String linkAreaCentral,
        BigDecimal valor,
        BigDecimal estoqueM2,
        String statusAreaCentral,
        Instant ultimaConsultaAreaCentralEm,
        boolean ativo,
        OrigemDadoProduto origemValor,
        OrigemDadoProduto origemEstoque,
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
                piso.getClassificacaoUso(),
                piso.getAcabamentoBordas(),
                piso.getLinkSite(),
                piso.getLinkFoto(),
                piso.getLinkFotoOrigem(),
                piso.getLinkAreaCentral(),
                piso.getValor(),
                piso.getEstoqueM2(),
                piso.getStatusAreaCentral(),
                piso.getUltimaConsultaAreaCentralEm(),
                piso.isAtivo(),
                piso.getOrigemValor(),
                piso.getOrigemEstoque(),
                piso.getCreatedAt(),
                piso.getUpdatedAt());
    }
}
