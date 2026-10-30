package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.application.*;
import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.Arguments;
import org.slf4j.LoggerFactory;

import javax.net.ssl.SSLException;
import java.io.IOException;
import java.net.ConnectException;
import java.net.UnknownHostException;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class HttpAreaCentralSessionVerifierDiagnosticsTest {
    private static final String CATALOG = """
            <select name="filtro[]"><option value="PF.REFERENCIA">Referência</option></select>
            <div class="product-name">HTML_PRIVADO_FICTICIO</div>
            """;
    private final AreaCentralCookieJar jar = new AreaCentralCookieJar(List.of(new AreaCentralCookie(
            "PHPSESSID", "COOKIE_PRIVADO_FICTICIO", "redeasso.areacentral.com.br", "/", true, true, "lax", null)));
    private final HttpClient client = mock(HttpClient.class);
    private final HttpAreaCentralSessionVerifier verifier = new HttpAreaCentralSessionVerifier(client);
    private final Logger logger = (Logger) LoggerFactory.getLogger(HttpAreaCentralSessionVerifier.class);
    private final ListAppender<ILoggingEvent> logs = new ListAppender<>();
    private Level previousLevel;

    @BeforeEach void capturaSomenteLoggerDoVerificador() {
        previousLevel = logger.getLevel();
        logger.setLevel(Level.WARN);
        logs.start();
        logger.addAppender(logs);
    }

    @AfterEach void restauraLogger() {
        logger.detachAppender(logs);
        logger.setLevel(previousLevel);
        logs.stop();
    }

    @ParameterizedTest
    @CsvSource({"302,HTTP_REDIRECT", "401,HTTP_UNAUTHORIZED", "403,HTTP_FORBIDDEN",
            "429,HTTP_RATE_LIMITED", "500,HTTP_ERROR"})
    void distingueStatusSemRegistrarCorpoOuCabecalhos(int status, String reason) {
        respond(status, "text/html", CATALOG);
        assertRejected(reason, Integer.toString(status));
    }

    @Test void distingueConteudoNaoHtmlSemRegistrarSeuValor() {
        respond(200, "application/json; CABECALHO_PRIVADO_FICTICIO", "HTML_PRIVADO_FICTICIO");
        assertRejected("UNEXPECTED_CONTENT_TYPE", "200");
    }

    static Stream<Arguments> documents() {
        return Stream.of(
                Arguments.of(CATALOG + "<input type=password value=SENHA_PRIVADA_FICTICIA>", "LOGIN_FORM_PRESENT"),
                Arguments.of(CATALOG + "<div class=cf-turnstile>DESAFIO_PRIVADO_FICTICIO</div>", "HUMAN_VERIFICATION_REQUIRED"),
                Arguments.of("<h1>HTML_PRIVADO_FICTICIO</h1>", "CATALOG_FILTER_MISSING"),
                Arguments.of("<select name='filtro[]'><option value='PF.REFERENCIA'>HTML_PRIVADO_FICTICIO</option></select>",
                        "CATALOG_PRODUCTS_MISSING"));
    }

    @ParameterizedTest @MethodSource("documents")
    void distingueMarcadoresSemExporHtml(String html, String reason) {
        respond(200, "text/html", html);
        assertRejected(reason, "200");
    }

    static Stream<Arguments> transportFailures() {
        return Stream.of(
                Arguments.of(new HttpTimeoutException("ERRO_PRIVADO_FICTICIO"), "TIMEOUT"),
                Arguments.of(new CompletionException(new HttpTimeoutException("ERRO_PRIVADO_FICTICIO")), "TIMEOUT"),
                Arguments.of(new SSLException("ERRO_PRIVADO_FICTICIO"), "TLS_ERROR"),
                Arguments.of(new UnknownHostException("ERRO_PRIVADO_FICTICIO"), "DNS_ERROR"),
                Arguments.of(new ConnectException("ERRO_PRIVADO_FICTICIO"), "CONNECTION_ERROR"),
                Arguments.of(new IOException("ERRO_PRIVADO_FICTICIO"), "NETWORK_ERROR"));
    }

    @ParameterizedTest @MethodSource("transportFailures") @SuppressWarnings("unchecked")
    void classificaFalhaDeRedeSemRegistrarExcecao(Throwable failure, String reason) {
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(CompletableFuture.failedFuture(failure));
        assertRejected(reason, "unavailable");
    }

    @Test @SuppressWarnings("unchecked")
    void timeoutDaEsperaCancelaRequisicaoSemAguardarTrintaSegundos() throws Exception {
        CompletableFuture<HttpResponse<byte[]>> pending = mock(CompletableFuture.class);
        when(pending.get(30, TimeUnit.SECONDS)).thenThrow(new TimeoutException("ERRO_PRIVADO_FICTICIO"));
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(pending);
        assertRejected("TIMEOUT", "unavailable");
        verify(pending).cancel(true);
    }

    @Test @SuppressWarnings("unchecked")
    void interrupcaoPreservaSinalECancelaRequisicao() throws Exception {
        CompletableFuture<HttpResponse<byte[]>> pending = mock(CompletableFuture.class);
        when(pending.get(30, TimeUnit.SECONDS)).thenThrow(new InterruptedException("ERRO_PRIVADO_FICTICIO"));
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenReturn(pending);
        try {
            assertRejected("INTERRUPTED", "unavailable");
            assertThat(Thread.currentThread().isInterrupted()).isTrue();
            verify(pending).cancel(true);
        } finally {
            Thread.interrupted();
        }
    }

    @Test @SuppressWarnings("unchecked")
    void falhaSincronaNaoVazaMensagemOuCausa() {
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenThrow(new IllegalStateException("ERRO_PRIVADO_FICTICIO"));
        assertRejected("UNEXPECTED_ERROR", "unavailable");
    }

    @Test void corpoAcimaDoLimitePreservaStatusRecebido() {
        failDownload(true);
        assertRejected("RESPONSE_TOO_LARGE", "200");
    }

    @Test void falhaDuranteDownloadPreservaCategoriaSemGuardarCausaExterna() {
        failDownload(false);
        assertRejected("TLS_ERROR", "200");
    }

    @Test void cookieAusenteNaoFazRequisicaoNemMudaErroDeLoginIncompleto() {
        assertThatThrownBy(() -> verifier.verify(new AreaCentralCookieJar(List.of())))
                .isInstanceOf(AreaCentralLoginIncompleteException.class);
        verifyNoInteractions(client);
        assertDiagnostic("MISSING_SESSION_COOKIE", "unavailable");
    }

    @Test void sucessoNaoGeraAvisoDeFalha() {
        respond(200, "text/html", CATALOG);
        assertThat(verifier.verify(jar).cookieJar()).isSameAs(jar);
        assertThat(logs.list).isEmpty();
    }

    @SuppressWarnings("unchecked")
    private void respond(int status, String contentType, String html) {
        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(status);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of(
                "Content-Type", List.of(contentType),
                "Location", List.of("https://example.invalid/CONCESSAO_PRIVADA_FICTICIA"),
                "Set-Cookie", List.of("PHPSESSID=COOKIE_PRIVADO_FICTICIO")), (a, b) -> true));
        when(response.body()).thenReturn(html.getBytes(StandardCharsets.UTF_8));
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class)))
                .thenReturn(CompletableFuture.completedFuture(response));
    }

    @SuppressWarnings("unchecked")
    private void failDownload(boolean oversized) {
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenAnswer(call -> {
            HttpResponse.BodyHandler<byte[]> handler = call.getArgument(1);
            HttpResponse.ResponseInfo info = mock(HttpResponse.ResponseInfo.class);
            when(info.statusCode()).thenReturn(200);
            HttpResponse.BodySubscriber<byte[]> subscriber = handler.apply(info);
            Flow.Subscription subscription = mock(Flow.Subscription.class);
            subscriber.onSubscribe(subscription);
            if (oversized) {
                subscriber.onNext(List.of(ByteBuffer.allocate(HttpAreaCentralSessionVerifier.MAX_DOWNLOAD_BYTES + 1)));
                verify(subscription).cancel();
            } else {
                subscriber.onError(new SSLException("ERRO_PRIVADO_FICTICIO"));
            }
            return subscriber.getBody().toCompletableFuture().thenApply(ignored -> mock(HttpResponse.class));
        });
    }

    private void assertRejected(String reason, String status) {
        assertThatThrownBy(() -> verifier.verify(jar))
                .isInstanceOf(AreaCentralIntegrationUnavailableException.class)
                .hasMessage("O Render não conseguiu validar a sessão no catálogo da Área Central. "
                        + "Ela pode ter expirado ou ter sido recusada pelo portal. Nenhum acesso foi liberado.")
                .hasNoCause();
        assertDiagnostic(reason, status);
    }

    private void assertDiagnostic(String reason, String status) {
        assertThat(logs.list).singleElement().satisfies(event -> {
            assertThat(event.getLevel()).isEqualTo(Level.WARN);
            assertThat(event.getFormattedMessage()).matches("area_central_session_validation_failed reason="
                    + reason + " upstream_status=" + status + " duration_ms=\\d+");
            assertThat(event.getThrowableProxy()).isNull();
            assertThat(event.getFormattedMessage()).doesNotContain(
                    "PRIVADO", "PRIVADA", "PHPSESSID", "areacentral.com.br");
        });
    }
}
