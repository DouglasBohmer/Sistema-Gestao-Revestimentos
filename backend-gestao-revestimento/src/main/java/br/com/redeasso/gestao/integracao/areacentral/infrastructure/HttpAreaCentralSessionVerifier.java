package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.springframework.stereotype.Component;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.nio.ByteBuffer;
import java.util.List;
import java.util.concurrent.*;
import java.util.stream.Collectors;

@Component
public class HttpAreaCentralSessionVerifier implements AreaCentralSessionVerifier {
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
        if (!jar.hasAuthenticatedSessionCookie()) throw new AreaCentralLoginIncompleteException();
        String header = jar.cookies().stream().map(cookie -> cookie.name() + "=" + cookie.value())
                .collect(Collectors.joining("; "));
        HttpRequest request = HttpRequest.newBuilder(CATALOG_URL).timeout(Duration.ofSeconds(25))
                .header("Accept", "text/html").header("Cookie", header).GET().build();
        CompletableFuture<HttpResponse<byte[]>> pending = client.sendAsync(request, ignored -> new LimitedBodySubscriber());
        try {
            HttpResponse<byte[]> response = pending.get(30, TimeUnit.SECONDS);
            // Não seguir redirects: jamais reenviar cookies para outra origem.
            if (response.statusCode() != 200 || !response.headers().firstValue("Content-Type")
                    .orElse("").toLowerCase(java.util.Locale.ROOT).contains("text/html")) {
                throw unavailable();
            }
            return verifyDocument(new String(response.body(), StandardCharsets.UTF_8), jar);
        } catch (ExecutionException | TimeoutException exception) {
            throw unavailable(); // Não propagar corpo, cabeçalhos ou causa com dados externos.
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw unavailable();
        } finally {
            pending.cancel(true);
        }
    }

    public static AreaCentralAuthenticatedLogin verifyDocument(String html, AreaCentralCookieJar jar) {
        Document document = Jsoup.parse(html);
        if (!jar.hasAuthenticatedSessionCookie()
                || document.selectFirst("#form-login, #USR_SENHA, input[type=password], .cf-turnstile") != null
                || document.selectFirst("select[name=\"filtro[]\"] option[value=\"PF.REFERENCIA\"]") == null
                || document.selectFirst(".product-name") == null) {
            throw unavailable();
        }
        // O identificador real ainda não foi caracterizado. Não aceitar nome arbitrário do cliente.
        return new AreaCentralAuthenticatedLogin("Área Central", jar);
    }

    private static AreaCentralIntegrationUnavailableException unavailable() {
        return new AreaCentralIntegrationUnavailableException(
                "O Render não conseguiu validar a sessão no catálogo da Área Central. "
                        + "Ela pode ter expirado ou ter sido recusada pelo portal. Nenhum acesso foi liberado.");
    }

    /** Limite durante o download, não após alocar HTML ilimitado. */
    static final class LimitedBodySubscriber implements HttpResponse.BodySubscriber<byte[]> {
        private final CompletableFuture<byte[]> body = new CompletableFuture<>();
        private final ByteArrayOutputStream output = new ByteArrayOutputStream();
        private Flow.Subscription subscription;
        public CompletionStage<byte[]> getBody() { return body; }
        public void onSubscribe(Flow.Subscription value) { subscription = value; value.request(1); }
        public void onNext(List<ByteBuffer> buffers) {
            for (ByteBuffer buffer : buffers) {
                if ((long) output.size() + buffer.remaining() > MAX_HTML_BYTES) {
                    subscription.cancel();
                    body.completeExceptionally(new IllegalStateException("HTML excede o limite"));
                    return;
                }
                byte[] bytes = new byte[buffer.remaining()];
                buffer.get(bytes);
                output.writeBytes(bytes);
            }
            subscription.request(1);
        }
        public void onError(Throwable ignored) { body.completeExceptionally(new IllegalStateException("Falha de comunicação")); }
        public void onComplete() { body.complete(output.toByteArray()); }
    }
}
