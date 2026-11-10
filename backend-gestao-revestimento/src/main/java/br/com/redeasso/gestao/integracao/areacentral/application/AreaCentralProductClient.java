package br.com.redeasso.gestao.integracao.areacentral.application;

import java.math.BigDecimal;

public interface AreaCentralProductClient {
    Product consultar(String codigo, AreaCentralCookieJar cookies);

    record Product(boolean encontrado, BigDecimal valorBrutoM2, BigDecimal estoqueM2, String status,
                   String nome, BigDecimal m2PorCaixa, String linkFoto) {
        public Product(boolean encontrado, BigDecimal valorBrutoM2, BigDecimal estoqueM2, String status) {
            this(encontrado, valorBrutoM2, estoqueM2, status, null, null, null);
        }
        public static Product naoEncontrado() { return new Product(false, null, null, "NAO_ENCONTRADO"); }
    }
}
