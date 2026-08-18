package br.com.redeasso.gestao.integracao.areacentral.application;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
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

        AreaCentralLoginAttemptState attempt = service.start("sessao-1");

        assertThat(attempt.status()).isEqualTo("WAITING_FOR_USER");
        assertThat(attempt.interactiveUrl()).isEqualTo("http://tailnet-exemplo:7900/?autoconnect=1");
        assertThat(attempt.expiresAt()).isAfter(java.time.Instant.now());
        assertThat(browser.openedUrl).isEqualTo(properties(true).loginUrl());
        assertThat(attempt.toString()).doesNotContain("PHPSESSID");
    }

    @Test
    void impedeDuasVerificacoesInterativasSimultaneas() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1");

        assertThatThrownBy(() -> service.start("sessao-2"))
                .isInstanceOf(AreaCentralLoginBusyException.class);
    }

    @Test
    void exigeCookieDaSessaoAntesDeConcluirESemFecharJanelaPrematuramente() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1");

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
        service.start("sessao-1");

        AreaCentralCookieJar cookieJar = service.complete("sessao-1");

        assertThat(cookieJar.hasAuthenticatedSessionCookie()).isTrue();
        assertThat(cookieJar.toString()).doesNotContain("valor-externo-que-nao-pode-vazar");
        assertThat(browser.closedSessionIds).containsExactly("browser-session-1");
        assertThat(service.start("sessao-2").status()).isEqualTo("WAITING_FOR_USER");
    }

    @Test
    void naoAceitaCookieDeVisitanteEnquantoOFormularioDeLoginAindaEstaVisivel() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        browser.cookies = List.of(new AreaCentralCookie(
                "PHPSESSID", "cookie-de-visitante", ".areacentral.com.br", "/", true, true, "Lax", null));
        browser.loginFormDisplayed = true;
        AreaCentralLoginService service = new AreaCentralLoginService(properties(true), browser);
        service.start("sessao-1");

        assertThatThrownBy(() -> service.complete("sessao-1"))
                .isInstanceOf(AreaCentralLoginIncompleteException.class);
        assertThat(browser.closedSessionIds).isEmpty();
    }

    @Test
    void recusaIntegracaoDesabilitadaSemAbrirNavegador() {
        FakeBrowserGateway browser = new FakeBrowserGateway();
        AreaCentralLoginService service = new AreaCentralLoginService(properties(false), browser);

        assertThatThrownBy(() -> service.start("sessao-1"))
                .isInstanceOf(AreaCentralIntegrationUnavailableException.class);
        assertThat(browser.openedUrl).isNull();
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
        private List<AreaCentralCookie> cookies = List.of();
        private boolean loginFormDisplayed;
        private final java.util.ArrayList<String> closedSessionIds = new java.util.ArrayList<>();

        @Override
        public AreaCentralBrowserSession open(URI loginUrl) {
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

        @Override
        public void close(String browserSessionId) {
            closedSessionIds.add(browserSessionId);
        }
    }
}
