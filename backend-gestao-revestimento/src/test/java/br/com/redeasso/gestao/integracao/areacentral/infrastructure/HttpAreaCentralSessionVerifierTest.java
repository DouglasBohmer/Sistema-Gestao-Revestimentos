package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.junit.jupiter.api.Test;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.any;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.*;

class HttpAreaCentralSessionVerifierTest {
    private final AreaCentralCookieJar jar = new AreaCentralCookieJar(List.of(new AreaCentralCookie(
            "PHPSESSID", "cookie-ficticio", "redeasso.areacentral.com.br", "/", true, true, "lax", null)));
    private final String catalog = """
            <html><body><select name="filtro[]"><option value="PF.REFERENCIA">Referência</option></select>
            <div class="product-name">Produto fictício</div></body></html>
            """;

    @Test void exigeMarcadoresDoCatalogoEUsaIdentidadeNaoForjada() {
        var verified = HttpAreaCentralSessionVerifier.verifyDocument(catalog, jar);
        assertThat(verified.username()).isEqualTo("Área Central");
        assertThat(verified.cookieJar()).isSameAs(jar);
    }
    @Test void cookieAnonimoNaoProvaLoginEFormularioDesafioOuHtmlIncompativelSaoRecusados() {
        for (String html : List.of("<h1>Login</h1>", catalog + "<input type=password>",
                catalog + "<div class=cf-turnstile></div>", "<h1>Just a moment...</h1>", "")) {
            assertThatThrownBy(() -> HttpAreaCentralSessionVerifier.verifyDocument(html, jar))
                    .isInstanceOf(AreaCentralIntegrationUnavailableException.class)
                    .hasMessageNotContaining("cookie-ficticio");
        }
        assertThatThrownBy(() -> HttpAreaCentralSessionVerifier.verifyDocument(catalog, new AreaCentralCookieJar(List.of())))
                .isInstanceOf(AreaCentralIntegrationUnavailableException.class);
    }

    @Test @SuppressWarnings("unchecked")
    void consultaSomenteUrlFixaComCookiesERecusaRedirectOuBloqueio() throws Exception {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of("Content-Type", List.of("text/html; charset=UTF-8")), (a, b) -> true));
        when(response.body()).thenReturn(catalog.getBytes(StandardCharsets.UTF_8));
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenAnswer(call -> {
            HttpRequest request = call.getArgument(0);
            assertThat(request.uri()).isEqualTo(HttpAreaCentralSessionVerifier.CATALOG_URL);
            assertThat(request.method()).isEqualTo("GET");
            assertThat(request.headers().firstValue("Cookie")).contains("PHPSESSID=cookie-ficticio");
            return CompletableFuture.completedFuture(response);
        });
        var verifier = new HttpAreaCentralSessionVerifier(client);
        assertThat(verifier.verify(jar).username()).isEqualTo("Área Central");
        for (int status : List.of(302, 401, 403, 500)) {
            when(response.statusCode()).thenReturn(status);
            assertThatThrownBy(() -> verifier.verify(jar)).isInstanceOf(AreaCentralIntegrationUnavailableException.class)
                    .hasMessageNotContaining("cookie-ficticio");
        }
    }

    @Test void downloadTemLimiteAntesDeArmazenarCorpoIlimitado() {
        var subscriber = new HttpAreaCentralSessionVerifier.LimitedBodySubscriber();
        var subscription = mock(Flow.Subscription.class);
        subscriber.onSubscribe(subscription);
        subscriber.onNext(List.of(ByteBuffer.allocate(4 * 1024 * 1024 + 1)));
        verify(subscription).cancel();
        assertThat(subscriber.getBody().toCompletableFuture()).isCompletedExceptionally();
    }
}
