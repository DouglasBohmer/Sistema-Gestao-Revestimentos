package br.com.redeasso.gestao.integracao.areacentral.application;

import java.net.URI;
import java.util.List;

/**
 * Controla um navegador remoto exclusivamente para o login assistido. O
 * contrato deliberadamente não oferece acesso ao conteúdo da página nem a
 * credenciais: somente à sessão opaca criada pelo usuário.
 */
public interface AreaCentralBrowserGateway {

    AreaCentralBrowserSession open(URI loginUrl);

    List<AreaCentralCookie> cookies(String browserSessionId);

    /**
     * True while the browser still renders an Área Central credential form.
     * This is deliberately checked in the remote browser so that a session
     * cookie created for an anonymous visitor is never accepted as a login.
     */
    boolean loginFormDisplayed(String browserSessionId);

    void close(String browserSessionId);
}
