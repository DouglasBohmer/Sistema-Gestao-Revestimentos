package br.com.redeasso.gestao.integracao.areacentral.application;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import org.junit.jupiter.api.Test;
import java.net.URI;
import java.time.*;
import java.util.List;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class AreaCentralBrowserTransferServiceTest {
    private final AreaCentralSessionVerifier verifier = mock(AreaCentralSessionVerifier.class);
    private final MutableClock clock = new MutableClock();
    private final AreaCentralBrowserTransferService transfers = new AreaCentralBrowserTransferService(properties(true), verifier, clock);

    @Test void exigeValidacaoRealIsolaSessoesEConsomeUmaUnicaVez() {
        var grant = transfers.start("origem");
        assertThat(grant.transferToken()).matches("[A-Za-z0-9_-]{43}");
        assertThat(grant.toString()).doesNotContain(grant.transferToken());
        assertThatThrownBy(() -> transfers.complete("origem")).isInstanceOf(AreaCentralLoginIncompleteException.class);
        when(verifier.verify(any())).thenAnswer(call -> new AreaCentralAuthenticatedLogin("Área Central", call.getArgument(0)));
        transfers.receive(grant.transferToken(), cookies());
        assertThat(transfers.current("origem").status()).isEqualTo("READY_TO_COMPLETE");
        assertThatThrownBy(() -> transfers.complete("outra")).isInstanceOf(AreaCentralLoginAttemptNotFoundException.class);
        assertThatThrownBy(() -> transfers.receive(grant.transferToken(), cookies())).isInstanceOf(AreaCentralLoginIncompleteException.class);
        assertThat(transfers.complete("origem").cookieJar().hasAuthenticatedSessionCookie()).isTrue();
        assertThatThrownBy(() -> transfers.complete("origem")).isInstanceOf(AreaCentralLoginAttemptNotFoundException.class);
        verify(verifier, times(1)).verify(any());
    }

    @Test void revogaAoCancelarReiniciarEExpirar() {
        var first = transfers.start("origem");
        var next = transfers.start("origem");
        assertThatThrownBy(() -> transfers.receive(first.transferToken(), cookies())).isInstanceOf(AreaCentralLoginAttemptNotFoundException.class);
        transfers.cancel("origem");
        assertThatThrownBy(() -> transfers.receive(next.transferToken(), cookies())).isInstanceOf(AreaCentralLoginAttemptNotFoundException.class);
        var expired = transfers.start("origem");
        clock.now = clock.now.plus(Duration.ofMinutes(10));
        assertThatThrownBy(() -> transfers.receive(expired.transferToken(), cookies())).isInstanceOf(AreaCentralLoginAttemptNotFoundException.class);
        verifyNoInteractions(verifier);
    }

    @Test void rejeitaDominioInjecaoDuplicidadeAusenciaEExpiracaoSemAcessarRede() {
        var invalid = List.of(
                new AreaCentralCookie("PHPSESSID", "ficticio", "outro.example", "/", true, true, "lax", null),
                new AreaCentralCookie("PHPSESSID", "a; b=c", "redeasso.areacentral.com.br", "/", true, true, "lax", null),
                new AreaCentralCookie("PHPSESSID", "a\r\nTeste: x", "redeasso.areacentral.com.br", "/", true, true, "lax", null),
                new AreaCentralCookie("PHPSESSID", "ficticio", "redeasso.areacentral.com.br", "/", true, true, "lax", clock.now),
                new AreaCentralCookie("outro", "ficticio", "redeasso.areacentral.com.br", "/", true, true, "lax", null));
        for (var cookie : invalid) {
            var grant = transfers.start("origem");
            assertThatThrownBy(() -> transfers.receive(grant.transferToken(), List.of(cookie))).isInstanceOf(AreaCentralLoginIncompleteException.class);
            assertThat(transfers.current("origem").status()).isEqualTo("REJECTED");
        }
        var duplicate = transfers.start("origem");
        assertThatThrownBy(() -> transfers.receive(duplicate.transferToken(), List.of(cookies().getFirst(), cookies().getFirst())))
                .isInstanceOf(AreaCentralLoginIncompleteException.class);
        verifyNoInteractions(verifier);
    }

    @Test void recusaFalhaDeValidacaoSemLiberarSessao() {
        var grant = transfers.start("origem");
        when(verifier.verify(any())).thenThrow(new AreaCentralIntegrationUnavailableException("Portal indisponível"));
        assertThatThrownBy(() -> transfers.receive(grant.transferToken(), cookies())).isInstanceOf(AreaCentralIntegrationUnavailableException.class);
        assertThat(transfers.current("origem").status()).isEqualTo("REJECTED");
        assertThatThrownBy(() -> transfers.complete("origem")).isInstanceOf(AreaCentralLoginIncompleteException.class);
    }

    @Test void cancelamentoDuranteValidacaoNaoRestauraSessao() throws Exception {
        var grant = transfers.start("origem");
        var entered = new CountDownLatch(1);
        var release = new CountDownLatch(1);
        when(verifier.verify(any())).thenAnswer(call -> {
            entered.countDown();
            assertThat(release.await(5, TimeUnit.SECONDS)).isTrue();
            return new AreaCentralAuthenticatedLogin("Área Central", call.getArgument(0));
        });
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var receive = executor.submit(() -> transfers.receive(grant.transferToken(), cookies()));
            assertThat(entered.await(5, TimeUnit.SECONDS)).isTrue();
            transfers.cancel("origem");
            release.countDown();
            receive.get(5, TimeUnit.SECONDS);
        }
        assertThatThrownBy(() -> transfers.complete("origem")).isInstanceOf(AreaCentralLoginAttemptNotFoundException.class);
    }

    @Test void respeitaFlagDaIntegracaoSemDependerDeNavegadorRemoto() {
        assertThatThrownBy(() -> new AreaCentralBrowserTransferService(properties(false), verifier).start("origem"))
                .isInstanceOf(AreaCentralIntegrationUnavailableException.class);
        assertThat(transfers.start("origem")).isNotNull();
    }

    static AreaCentralProperties properties(boolean enabled) {
        return new AreaCentralProperties(enabled, URI.create("https://redeasso.areacentral.com.br"),
                URI.create("https://redeasso.areacentral.com.br/401/"), URI.create("http://localhost:10000"),
                null, null, null, Duration.ofSeconds(5), Duration.ofSeconds(10), Duration.ofMinutes(10));
    }
    static List<AreaCentralCookie> cookies() {
        return List.of(new AreaCentralCookie("PHPSESSID", "cookie-ficticio-privado", "redeasso.areacentral.com.br", "/", true, true, "lax", null));
    }
    static class MutableClock extends Clock {
        Instant now = Instant.parse("2026-10-16T12:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return now; }
    }
}
