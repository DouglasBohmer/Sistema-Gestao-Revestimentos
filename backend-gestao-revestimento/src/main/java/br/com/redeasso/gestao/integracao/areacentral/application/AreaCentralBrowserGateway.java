package br.com.redeasso.gestao.integracao.areacentral.application;

import java.net.URI;
import java.time.Instant;
import java.util.List;

/**
 * Controla um navegador remoto exclusivamente para o login assistido. O
 * contrato não expõe conteúdo da página ao frontend nem aceita ações no
 * CAPTCHA. As credenciais são usadas uma única vez para preencher o formulário
 * no navegador remoto e jamais devem ser persistidas ou registradas em log.
 */
public interface AreaCentralBrowserGateway {

    AreaCentralBrowserSession open(
            URI loginUrl,
            String username,
            char[] password,
            String interactiveAccessId,
            Instant expiresAt);

    List<AreaCentralCookie> cookies(String browserSessionId);

    /**
     * True while the browser still renders an Área Central credential form.
     * This is deliberately checked in the remote browser so that a session
     * cookie created for an anonymous visitor is never accepted as a login.
     */
    boolean loginFormDisplayed(String browserSessionId);

    /** Revoga imediatamente o token que permite visualizar o noVNC da tentativa. */
    void revokeInteractiveAccess(String interactiveAccessId);

    void close(String browserSessionId);
}
