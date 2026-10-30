package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLException;
import java.io.ByteArrayOutputStream;
import java.net.ConnectException;
import java.net.URI;
import java.net.UnknownHostException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

@Component
public class HttpAreaCentralSessionVerifier implements AreaCentralSessionVerifier {
    private static final Logger LOGGER = LoggerFactory.getLogger(HttpAreaCentralSessionVerifier.class);
    public static final URI CATALOG_URL = URI.create(
            "https://redeasso.areacentral.com.br/401/?pg=associado_catalogos_produtos&ordenacao=nome-asc");
    private static final int MAX_HTML_BYTES = 4 * 1024 * 1024;
    private final HttpClient client;

    @org.springframework.beans.factory.annotation.Autowired
    public HttpAreaCentralSessionVerifier(AreaCentralProperties properties) {
        this(HttpClient.newBuilder().connectTimeout(properties.connectTimeout())
                .followRedirects(HttpClient.Redirect.NEVER).build());
    }

    HttpAreaCentralSessionVerifier(HttpClient client) { this.client = client; }

    @Override
    public AreaCentralAuthenticatedLogin verify(AreaCentralCookieJar jar) {
        long started = System.nanoTime();
        AtomicInteger upstreamStatus = new AtomicInteger();
        if (!jar.hasAuthenticatedSessionCookie()) {
            logFailure(FailureReason.MISSING_SESSION_COOKIE, upstreamStatus.get(), started);
            throw new AreaCentralLoginIncompleteException();
        }
        String header = jar.cookies().stream().map(cookie -> cookie.name() + "=" + cookie.value())
                .collect(Collectors.joining("; "));
        HttpRequest request = HttpRequest.newBuilder(CATALOG_URL).timeout(Duration.ofSeconds(25))
                .header("Accept", "text/html").header("Cookie", header).GET().build();
        CompletableFuture<HttpResponse<byte[]>> pending = null;
        try {
            pending = client.sendAsync(request, info -> {
                // Preservar apenas o status, inclusive se o download falhar depois dos cabeçalhos.
                upstreamStatus.set(info.statusCode());
                return new LimitedBodySubscriber();
            });
            HttpResponse<byte[]> response = pending.get(30, TimeUnit.SECONDS);
            upstreamStatus.set(response.statusCode());
            // Não seguir redirects: jamais reenviar cookies para outra origem.
            if (response.statusCode() != 200) {
                throw unavailable(httpFailureReason(response.statusCode()));
            }
            if (!response.headers().firstValue("Content-Type")
                    .orElse("").toLowerCase(java.util.Locale.ROOT).contains("text/html")) {
                throw unavailable(FailureReason.UNEXPECTED_CONTENT_TYPE);
            }
            return verifyDocument(new String(response.body(), StandardCharsets.UTF_8), jar);
        } catch (VerificationFailure exception) {
            logFailure(exception.reason, upstreamStatus.get(), started);
            throw exception;
        } catch (ExecutionException | TimeoutException exception) {
            FailureReason reason = transportFailureReason(exception);
            logFailure(reason, upstreamStatus.get(), started);
            throw unavailable(reason);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            logFailure(FailureReason.INTERRUPTED, upstreamStatus.get(), started);
            throw unavailable(FailureReason.INTERRUPTED);
        } catch (RuntimeException exception) {
            logFailure(FailureReason.UNEXPECTED_ERROR, upstreamStatus.get(), started);
            throw unavailable(FailureReason.UNEXPECTED_ERROR);
        } finally {
            if (pending != null) pending.cancel(true);
        }
    }

    public static AreaCentralAuthenticatedLogin verifyDocument(String html, AreaCentralCookieJar jar) {
        if (!jar.hasAuthenticatedSessionCookie()) throw unavailable(FailureReason.MISSING_SESSION_COOKIE);
        Document document = Jsoup.parse(html);
        if (document.selectFirst(".cf-turnstile") != null) {
            throw unavailable(FailureReason.HUMAN_VERIFICATION_REQUIRED);
        }
        if (document.selectFirst("#form-login, #USR_SENHA, input[type=password]") != null) {
            throw unavailable(FailureReason.LOGIN_FORM_PRESENT);
        }
        if (document.selectFirst("select[name=\"filtro[]\"] option[value=\"PF.REFERENCIA\"]") == null) {
            throw unavailable(FailureReason.CATALOG_FILTER_MISSING);
        }
        if (document.selectFirst(".product-name") == null) {
            throw unavailable(FailureReason.CATALOG_PRODUCTS_MISSING);
        }
        // O identificador real ainda não foi caracterizado. Não aceitar nome arbitrário do cliente.
        return new AreaCentralAuthenticatedLogin("Área Central", jar);
    }

    private static FailureReason httpFailureReason(int status) {
        if (status >= 300 && status < 400) return FailureReason.HTTP_REDIRECT;
        return switch (status) {
            case 401 -> FailureReason.HTTP_UNAUTHORIZED;
            case 403 -> FailureReason.HTTP_FORBIDDEN;
            case 429 -> FailureReason.HTTP_RATE_LIMITED;
            default -> FailureReason.HTTP_ERROR;
        };
    }

    private static FailureReason transportFailureReason(Throwable failure) {
        // Classificar por tipos conhecidos, nunca por mensagens, URLs ou dados do portal.
        for (int depth = 0; failure != null && depth < 8; depth++, failure = failure.getCause()) {
            if (failure instanceof DownloadFailure download) return download.reason;
            if (failure instanceof HttpTimeoutException || failure instanceof TimeoutException) return FailureReason.TIMEOUT;
            if (failure instanceof SSLException) return FailureReason.TLS_ERROR;
            if (failure instanceof UnknownHostException) return FailureReason.DNS_ERROR;
            if (failure instanceof ConnectException) return FailureReason.CONNECTION_ERROR;
        }
        return FailureReason.NETWORK_ERROR;
    }

    private static void logFailure(FailureReason reason, int status, long started) {
        // Allowlist estrita: sem exceção/stack trace, cookie, HTML, cabeçalho, conta ou ID da tentativa.
        Object safeStatus = status >= 100 && status <= 599 ? status : "unavailable";
        long duration = Math.max(0, TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
        LOGGER.warn("area_central_session_validation_failed reason={} upstream_status={} duration_ms={}",
                reason, safeStatus, duration);
    }

    private static VerificationFailure unavailable(FailureReason reason) {
        return new VerificationFailure(reason);
    }

    private enum FailureReason {
        MISSING_SESSION_COOKIE, HTTP_REDIRECT, HTTP_UNAUTHORIZED, HTTP_FORBIDDEN, HTTP_RATE_LIMITED, HTTP_ERROR,
        UNEXPECTED_CONTENT_TYPE, HUMAN_VERIFICATION_REQUIRED, LOGIN_FORM_PRESENT,
        CATALOG_FILTER_MISSING, CATALOG_PRODUCTS_MISSING, RESPONSE_TOO_LARGE,
        TIMEOUT, TLS_ERROR, DNS_ERROR, CONNECTION_ERROR, NETWORK_ERROR, INTERRUPTED, UNEXPECTED_ERROR
    }

    private static final class VerificationFailure extends AreaCentralIntegrationUnavailableException {
        private final FailureReason reason;
        private VerificationFailure(FailureReason reason) {
            super("O Render não conseguiu validar a sessão no catálogo da Área Central. "
                    + "Ela pode ter expirado ou ter sido recusada pelo portal. Nenhum acesso foi liberado.");
            this.reason = reason;
        }
    }

    private static final class DownloadFailure extends RuntimeException {
        private final FailureReason reason;
        private DownloadFailure(FailureReason reason) { this.reason = reason; }
    }

    /** Limite durante o download, não após alocar HTML ilimitado. */
    static final class LimitedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> body = new CompletableFuture<>();
        private final ByteArrayOutputStream output = new ByteArrayOutputStream();
        private Flow.Subscription subscription;
        public CompletionStage<byte[]> getBody() { return body; }
        public void onSubscribe(Flow.Subscription value) { subscription = value; value.request(1); }
        public void onNext(List<ByteBuffer> buffers) {
            if (body.isDone()) return;
            for (ByteBuffer buffer : buffers) {
                if ((long) output.size() + buffer.remaining() > MAX_HTML_BYTES) {
                    subscription.cancel();
                    body.completeExceptionally(new DownloadFailure(FailureReason.RESPONSE_TOO_LARGE));
                    return;
                }
                byte[] bytes = new byte[buffer.remaining()];
                buffer.get(bytes);
                output.writeBytes(bytes);
            }
            subscription.request(1);
        }
        public void onError(Throwable failure) {
            body.completeExceptionally(new DownloadFailure(transportFailureReason(failure)));
        }
        public void onComplete() { body.complete(output.toByteArray()); }
    }
}
