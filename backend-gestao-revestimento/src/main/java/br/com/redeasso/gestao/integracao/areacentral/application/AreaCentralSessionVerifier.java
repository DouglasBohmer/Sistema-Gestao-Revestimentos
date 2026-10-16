package br.com.redeasso.gestao.integracao.areacentral.application;

/** Consulta somente leitura ao catálogo real; nunca confiar em marcadores enviados pelo cliente. */
public interface AreaCentralSessionVerifier {
    AreaCentralAuthenticatedLogin verify(AreaCentralCookieJar cookieJar);
}
