package br.com.redeasso.gestao.integracao.areacentral.application;

import java.net.URI;
import java.time.Instant;
import java.util.List;

/**
 * Controla um navegador remoto exclusivamente para o login assistido. O
 * contrato não expõe conteúdo da página ao frontend nem aceita ações no
 * CAPTCHA. Credenciais podem preencher o formulário real, sem resolver,
 * desativar ou simular a aprovação do Turnstile.
 */
public interface AreaCentralBrowserGateway {

    AreaCentralBrowserSession open(
            URI loginUrl,
            String interactiveAccessId,
            Instant expiresAt);

    default AreaCentralBrowserSession open(
            URI loginUrl, String interactiveAccessId, Instant expiresAt, String username, String password) {
        return open(loginUrl, interactiveAccessId, expiresAt);
    }

    default String loginStatus(String browserSessionId) {
        return loginFormDisplayed(browserSessionId) ? "WAITING_FOR_HUMAN" : "READY_TO_COMPLETE";
    }

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
