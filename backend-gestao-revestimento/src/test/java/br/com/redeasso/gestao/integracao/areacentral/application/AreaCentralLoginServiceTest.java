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

        AreaCentralLoginAttemptState attempt = service.start("sessao-1", "usuario-area-central", "senha-efemera");

        assertThat(attempt.status()).isEqualTo("WAITING_FOR_HUMAN");
        assertThat(attempt.interactiveUrl()).isEqualTo("http://tailnet-exemplo:7900/?autoconnect=1");
        assertThat(attempt.expiresAt()).isAfter(java.time.Instant.now());
        assertThat(browser.openedUrl).isEqualTo(properties(true).loginUrl());
        assertThat(browser.openedUsername).isEqualTo("usuario-area-central");
        assertThat(browser.passwordAtGatewayInvocation).containsExactly('s', 'e', 'n', 'h', 'a', '-', 'e', 'f', 'e', 'm', 'e', 'r', 'a');
        assertThat(browser.passwordReferenceAfterInvocation).containsOnly('\0');
        assertThat(attempt.toString()).doesNotContain("PHPSESSID");
    }

    @Test
    void impedeDuasVerificacoesInterativasSimultaneas() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1", "usuario", "senha");

        assertThatThrownBy(() -> service.start("sessao-2", "outro-usuario", "outra-senha"))
                .isInstanceOf(AreaCentralLoginBusyException.class);
    }

    @Test
    void exigeCookieDaSessaoAntesDeConcluirESemFecharJanelaPrematuramente() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1", "usuario", "senha");

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
        service.start("sessao-1", "usuario", "senha");

        AreaCentralAuthenticatedLogin completedLogin = service.complete("sessao-1");

        assertThat(completedLogin.username()).isEqualTo("usuario");
        assertThat(completedLogin.cookieJar().hasAuthenticatedSessionCookie()).isTrue();
        assertThat(completedLogin.cookieJar().toString()).doesNotContain("valor-externo-que-nao-pode-vazar");
        assertThat(browser.closedSessionIds).containsExactly("browser-session-1");
        assertThat(service.start("sessao-2", "outro", "senha").status()).isEqualTo("READY_TO_COMPLETE");
    }

    @Test
    void naoAceitaCookieDeVisitanteEnquantoOFormularioDeLoginAindaEstaVisivel() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        browser.cookies = List.of(new AreaCentralCookie(
                "PHPSESSID", "cookie-de-visitante", ".areacentral.com.br", "/", true, true, "Lax", null));
        browser.loginFormDisplayed = true;
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1", "usuario", "senha");

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
        service.start("sessao-1", "usuario", "senha");

        assertThat(service.current("sessao-1").status()).isEqualTo("READY_TO_COMPLETE");
        assertThat(browser.closedSessionIds).isEmpty();
    }

    @Test
    void recusaIntegracaoDesabilitadaSemAbrirNavegador() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(false), browser);

        assertThatThrownBy(() -> service.start("sessao-1", "usuario", "senha"))
                .isInstanceOf(AreaCentralIntegrationUnavailableException.class);
        assertThat(browser.openedUrl).isNull();
    }

    @Test
    void credencialDeEntradaNuncaApareceEmRepresentacaoTextual() {
        StartAreaCentralLoginRequest request = new StartAreaCentralLoginRequest("usuario", "senha-secreta");

        assertThat(request).hasToString("StartAreaCentralLoginRequest[username=usuario, password=[REDACTED]]");
    }

    private static AreaCentralProperties properties(boolean enabled) {
        return new AreaCentralProperties(
                enabled,
                URI.create("https://redeasso.areacentral.com.br"),
                URI.create("https://redeasso.areacentral.com.br/401/?pg=associado_catalogos_produtos"),
                URI.create("http://area-central-browser:4444"),
                "http://tailnet-exemplo:7900/?autoconnect=1",
                Duration.ofSeconds(5),
                Duration.ofSeconds(10),
                Duration.ofMinutes(10));
    }

    private static final class FakeBrowserGateway implements AreaCentralBrowserGateway {
        private URI openedUrl;
        private String openedUsername;
        private char[] passwordAtGatewayInvocation;
        private char[] passwordReferenceAfterInvocation;
        private List<AreaCentralCookie> cookies = List.of();
        private boolean loginFormDisplayed;
        private final java.util.ArrayList<String> closedSessionIds = new java.util.ArrayList<>();

        @Override
        public AreaCentralBrowserSession open(URI loginUrl, String username, char[] password) {
            openedUrl = loginUrl;
            openedUsername = username;
            passwordAtGatewayInvocation = password.clone();
            passwordReferenceAfterInvocation = password;
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

        @Override
        public void close(String browserSessionId) {
            closedSessionIds.add(browserSessionId);
        }
    }
}
