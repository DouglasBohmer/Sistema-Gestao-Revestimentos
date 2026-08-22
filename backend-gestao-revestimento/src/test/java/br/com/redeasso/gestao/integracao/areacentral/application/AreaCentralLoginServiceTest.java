package br.com.redeasso.gestao.integracao.areacentral.application;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.api.dto.StartAreaCentralLoginRequest;
import org.junit.jupiter.api.Test;

import java.net.URI;
import java.time.Duration;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AreaCentralLoginServiceTest {

    @Test
    void abreNavegadorIsoladoERetornaSomenteDadosDaInteracao() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);

        AreaCentralLoginAttemptState attempt = service.start("sessao-1", "usuario-area-central");

        assertThat(attempt.status()).isEqualTo("WAITING_FOR_HUMAN");
        assertThat(attempt.interactiveUrl()).startsWith("https://browser-exemplo.onrender.com/vnc.html?autoconnect=1");
        assertThat(attempt.interactiveUrl()).contains("path=websockify%3Ftoken%3Dv1.");
        assertThat(attempt.expiresAt()).isAfter(java.time.Instant.now());
        assertThat(browser.openedUrl).isEqualTo(properties(true).loginUrl());
        assertThat(attempt.toString()).doesNotContain("PHPSESSID");
    }

    @Test
    void impedeDuasVerificacoesInterativasSimultaneas() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1", "usuario");

        assertThatThrownBy(() -> service.start("sessao-2", "outro-usuario"))
                .isInstanceOf(AreaCentralLoginBusyException.class);
    }

    @Test
    void exigeCookieDaSessaoAntesDeConcluirESemFecharJanelaPrematuramente() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1", "usuario");

        assertThatThrownBy(() -> service.complete("sessao-1"))
                .isInstanceOf(AreaCentralLoginIncompleteException.class);
        assertThat(browser.closedSessionIds).isEmpty();
    }

    @Test
    void capturaCookieSomenteEmMemoriaEFechaNavegadorAoConcluir() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        browser.cookies = List.of(new AreaCentralCookie(
                "PHPSESSID", "valor-externo-que-nao-pode-vazar", ".areacentral.com.br", "/", true, true, "Lax", null));
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1", "usuario");

        AreaCentralAuthenticatedLogin completedLogin = service.complete("sessao-1");

        assertThat(completedLogin.username()).isEqualTo("usuario");
        assertThat(completedLogin.cookieJar().hasAuthenticatedSessionCookie()).isTrue();
        assertThat(completedLogin.cookieJar().toString()).doesNotContain("valor-externo-que-nao-pode-vazar");
        assertThat(browser.closedSessionIds).containsExactly("browser-session-1");
        assertThat(browser.revokedAccessIds).hasSize(1);
        assertThat(service.start("sessao-2", "outro").status()).isEqualTo("READY_TO_COMPLETE");
    }

    @Test
    void naoAceitaCookieDeVisitanteEnquantoOFormularioDeLoginAindaEstaVisivel() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        browser.cookies = List.of(new AreaCentralCookie(
                "PHPSESSID", "cookie-de-visitante", ".areacentral.com.br", "/", true, true, "Lax", null));
        browser.loginFormDisplayed = true;
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1", "usuario");

        assertThatThrownBy(() -> service.complete("sessao-1"))
                .isInstanceOf(AreaCentralLoginIncompleteException.class);
        assertThat(browser.closedSessionIds).isEmpty();
    }

    @Test
    void informaQuandoOCaptchaFoiConcluidoEOLoginEstaPronto() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        browser.cookies = List.of(new AreaCentralCookie(
                "PHPSESSID", "sessao-autenticada", ".areacentral.com.br", "/", true, true, "Lax", null));
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1", "usuario");

        assertThat(service.current("sessao-1").status()).isEqualTo("READY_TO_COMPLETE");
        assertThat(browser.closedSessionIds).isEmpty();
    }

    @Test
    void recusaIntegracaoDesabilitadaSemAbrirNavegador() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(false), browser);

        assertThatThrownBy(() -> service.start("sessao-1", "usuario"))
                .isInstanceOf(AreaCentralIntegrationUnavailableException.class);
        assertThat(browser.openedUrl).isNull();
    }

    @Test
    void identificadorDeEntradaNuncaIncluiSenhaEmRepresentacaoTextual() {
        StartAreaCentralLoginRequest request = new StartAreaCentralLoginRequest("usuario");

        assertThat(request).hasToString("StartAreaCentralLoginRequest[username=usuario]");
    }

    private static AreaCentralProperties properties(boolean enabled) {
        return new AreaCentralProperties(
                enabled,
                URI.create("https://redeasso.areacentral.com.br"),
                URI.create("https://redeasso.areacentral.com.br/401/?pg=associado_catalogos_produtos"),
                URI.create("https://browser-exemplo.onrender.com"),
                "https://browser-exemplo.onrender.com/vnc.html",
                "chave-interna-de-teste",
                "segredo-hmac-de-teste",
                Duration.ofSeconds(5),
                Duration.ofSeconds(10),
                Duration.ofMinutes(10));
    }

    private static final class FakeBrowserGateway implements AreaCentralBrowserGateway {
        private URI openedUrl;
        private List<AreaCentralCookie> cookies = List.of();
        private boolean loginFormDisplayed;
        private final java.util.ArrayList<String> closedSessionIds = new java.util.ArrayList<>();

        @Override
        public AreaCentralBrowserSession open(
                URI loginUrl,
                String interactiveAccessId,
                java.time.Instant expiresAt) {
            openedUrl = loginUrl;
            return new AreaCentralBrowserSession("browser-session-1");
        }

        @Override
        public List<AreaCentralCookie> cookies(String browserSessionId) {
            return cookies;
        }

        @Override
        public boolean loginFormDisplayed(String browserSessionId) {
            return loginFormDisplayed;
        }

        private final java.util.ArrayList<String> revokedAccessIds = new java.util.ArrayList<>();

        @Override
        public void revokeInteractiveAccess(String interactiveAccessId) {
            revokedAccessIds.add(interactiveAccessId);
        }

        @Override
        public void close(String browserSessionId) {
            closedSessionIds.add(browserSessionId);
        }
    }
}
