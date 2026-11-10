package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import java.math.BigDecimal;
import java.util.List;

/** Rascunho autenticado para revisão no cadastro. Não contém cookies nem grava produtos. */
public record PisoConsultaAreaCentralResponse(
        String codigoRede, boolean encontrado, String nome,
        BigDecimal valorBrutoM2, BigDecimal valorVendaM2, BigDecimal estoqueM2,
        String statusAreaCentral, BigDecimal m2PorCaixa, String linkFoto,
        BigDecimal largura, BigDecimal altura, AcabamentoBorda acabamentoBordas,
        List<PisoResponse> cadastros) {}
