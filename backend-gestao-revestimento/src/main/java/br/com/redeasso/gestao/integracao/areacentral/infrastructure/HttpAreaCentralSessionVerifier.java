package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.jsoup.nodes.Element;
import org.jsoup.parser.Parser;
import org.jsoup.parser.StreamParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLException;
import java.io.*;
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
import java.util.zip.GZIPInputStream;

@Component
public class HttpAreaCentralSessionVerifier implements AreaCentralSessionVerifier {
    private static final Logger LOGGER = LoggerFactory.getLogger(HttpAreaCentralSessionVerifier.class);
    public static final URI CATALOG_URL = URI.create(
            "https://redeasso.areacentral.com.br/401/?pg=associado_catalogos_produtos&ordenacao=nome-asc");
    static final int MAX_DOWNLOAD_BYTES = 16 * 1024 * 1024;
    static final int MAX_HTML_BYTES = 32 * 1024 * 1024;
    private static final long MAX_VALIDATION_NANOS = Duration.ofSeconds(30).toNanos();
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
                .header("Accept", "text/html").header("Accept-Encoding", "gzip")
                .header("Cookie", header).GET().build();
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
            return verifyBody(response, jar, started);
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
        } catch (IOException | UncheckedIOException exception) {
            logFailure(FailureReason.INVALID_RESPONSE_BODY, upstreamStatus.get(), started);
            throw unavailable(FailureReason.INVALID_RESPONSE_BODY);
        } catch (RuntimeException exception) {
            logFailure(FailureReason.UNEXPECTED_ERROR, upstreamStatus.get(), started);
            throw unavailable(FailureReason.UNEXPECTED_ERROR);
        } finally {
            if (pending != null) pending.cancel(true);
        }
    }

    public static AreaCentralAuthenticatedLogin verifyDocument(String html, AreaCentralCookieJar jar) {
        return verifyReader(new StringReader(html), jar, System.nanoTime());
    }

    private static AreaCentralAuthenticatedLogin verifyBody(HttpResponse<byte[]> response,
                                                            AreaCentralCookieJar jar, long started) throws IOException {
        byte[] bytes = response.body();
        if (bytes.length > MAX_DOWNLOAD_BYTES) throw unavailable(FailureReason.RESPONSE_TOO_LARGE);
        String encoding = response.headers().firstValue("Content-Encoding").orElse("identity").trim();
        InputStream input = new ByteArrayInputStream(bytes);
        if ("gzip".equalsIgnoreCase(encoding)) input = new GZIPInputStream(input);
        else if (!"identity".equalsIgnoreCase(encoding) && !encoding.isEmpty()) {
            throw unavailable(FailureReason.UNSUPPORTED_CONTENT_ENCODING);
        }
        try (Reader reader = new InputStreamReader(new LimitedHtmlInputStream(input, started), StandardCharsets.UTF_8)) {
            return verifyReader(reader, jar, started);
        }
    }

    private static AreaCentralAuthenticatedLogin verifyReader(Reader reader, AreaCentralCookieJar jar, long started) {
        if (!jar.hasAuthenticatedSessionCookie()) throw unavailable(FailureReason.MISSING_SESSION_COOKIE);
        boolean challenge = false, login = false, filter = false, product = false;
        try (StreamParser parser = new StreamParser(Parser.htmlParser()).parse(reader, CATALOG_URL.toString())) {
            var elements = parser.iterator();
            while (elements.hasNext()) {
                checkDeadline(started);
                Element element = elements.next();
                challenge |= element.hasClass("cf-turnstile");
                login |= "form-login".equals(element.id()) || "USR_SENHA".equals(element.id())
                        || ("input".equals(element.normalName()) && "password".equalsIgnoreCase(element.attr("type")));
                filter |= "option".equals(element.normalName()) && "PF.REFERENCIA".equals(element.attr("value"))
                        && element.closest("select[name=\"filtro[]\"]") != null;
                product |= element.hasClass("product-name");
                // Não acumular milhares de produtos nem construir uma cópia String de todo o HTML.
                Element parent = element.parent();
                element.remove();
                if (parent != null) parent.textNodes().forEach(text -> text.remove());
            }
        }
        // Validar somente após consumir o documento inteiro: um formulário/desafio no final também recusa o acesso.
        if (challenge) throw unavailable(FailureReason.HUMAN_VERIFICATION_REQUIRED);
        if (login) throw unavailable(FailureReason.LOGIN_FORM_PRESENT);
        if (!filter) throw unavailable(FailureReason.CATALOG_FILTER_MISSING);
        if (!product) throw unavailable(FailureReason.CATALOG_PRODUCTS_MISSING);
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

    private static void checkDeadline(long started) {
        if (Thread.currentThread().isInterrupted()) throw unavailable(FailureReason.INTERRUPTED);
        if (System.nanoTime() - started > MAX_VALIDATION_NANOS) throw unavailable(FailureReason.TIMEOUT);
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
        INVALID_RESPONSE_BODY, UNSUPPORTED_CONTENT_ENCODING,
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

    /** Limita também o HTML descompactado, para que gzip não retire a proteção de memória. */
    private static final class LimitedHtmlInputStream extends FilterInputStream {
        private final long started;
        private int count;
        private LimitedHtmlInputStream(InputStream input, long started) { super(input); this.started = started; }
        @Override public int read() throws IOException {
            checkDeadline(started);
            int value = in.read();
            if (value != -1) checkSize(1);
            return value;
        }
        @Override public int read(byte[] bytes, int offset, int length) throws IOException {
            checkDeadline(started);
            int read = in.read(bytes, offset, Math.min(length, MAX_HTML_BYTES - count + 1));
            if (read > 0) checkSize(read);
            return read;
        }
        private void checkSize(int read) {
            count += read;
            if (count > MAX_HTML_BYTES) throw unavailable(FailureReason.RESPONSE_TOO_LARGE);
        }
    }

    /** Limite durante o download, não após alocar HTML ilimitado. */
    static final class LimitedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final int limit;
        LimitedBodySubscriber() { this(MAX_DOWNLOAD_BYTES); }
        LimitedBodySubscriber(int limit) { this.limit = limit; }
        private final CompletableFuture<byte[]> body = new CompletableFuture<>();
        private final ByteArrayOutputStream output = new ByteArrayOutputStream();
        private Flow.Subscription subscription;
        public CompletionStage<byte[]> getBody() { return body; }
        public void onSubscribe(Flow.Subscription value) { subscription = value; value.request(1); }
        public void onNext(List<ByteBuffer> buffers) {
            if (body.isDone()) return;
            for (ByteBuffer buffer : buffers) {
                if ((long) output.size() + buffer.remaining() > limit) {
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
