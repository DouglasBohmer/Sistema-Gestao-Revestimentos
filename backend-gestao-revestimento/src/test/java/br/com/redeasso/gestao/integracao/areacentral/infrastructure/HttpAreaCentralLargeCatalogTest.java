package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Flow;
import java.util.zip.GZIPOutputStream;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class HttpAreaCentralLargeCatalogTest {
    private static final String MARKERS = """
            <select name="filtro[]"><optgroup label="Filtro"><option value="PF.REFERENCIA">Referência</option></optgroup></select>
            <div class="product-name"><span>Produto fictício</span></div>
            """;
    private final AreaCentralCookieJar jar = new AreaCentralCookieJar(List.of(new AreaCentralCookie(
            "PHPSESSID", "cookie-ficticio-privado", "redeasso.areacentral.com.br", "/", true, true, "lax", null)));

    @Test void aceitaCatalogoMaiorQueQuatroMiBSemExigirCompressaoDoServidor() {
        byte[] html = largeCatalog("").getBytes(StandardCharsets.UTF_8);
        assertThat(html.length).isGreaterThan(4 * 1024 * 1024);
        assertThat(verifier(html, "identity").verify(jar).username()).isEqualTo("Área Central");
    }

    @Test void solicitaGzipEValidaCatalogoGrandeDescompactado() throws IOException {
        byte[] html = largeCatalog("").getBytes(StandardCharsets.UTF_8);
        byte[] compressed = gzip(html);
        assertThat(compressed.length).isLessThan(html.length / 10);
        assertThat(verifier(compressed, "gzip").verify(jar).cookieJar()).isSameAs(jar);
    }

    @Test void duasValidacoesCompactadasPodemExecutarSemCompartilharParserOuCookieJar() throws Exception {
        byte[] compressed = gzip(largeCatalog("").getBytes(StandardCharsets.UTF_8));
        var firstVerifier = verifier(compressed, "gzip");
        var secondVerifier = verifier(compressed, "gzip");
        var otherJar = new AreaCentralCookieJar(List.of(new AreaCentralCookie(
                "PHPSESSID", "outra-sessao-ficticia", "redeasso.areacentral.com.br", "/", true, true, "lax", null)));
        try (var executor = java.util.concurrent.Executors.newVirtualThreadPerTaskExecutor()) {
            var first = executor.submit(() -> firstVerifier.verify(jar));
            var second = executor.submit(() -> secondVerifier.verify(otherJar));
            assertThat(first.get(10, java.util.concurrent.TimeUnit.SECONDS).cookieJar()).isSameAs(jar);
            assertThat(second.get(10, java.util.concurrent.TimeUnit.SECONDS).cookieJar()).isSameAs(otherJar);
        }
    }

    @Test void formularioNoFinalDoCatalogoGrandeContinuaRecusandoLogin() {
        assertRejected(verifier(largeCatalog("<input type=PASSWORD>").getBytes(StandardCharsets.UTF_8), "identity"));
    }

    @Test void desafioNoFinalDoCatalogoGrandeContinuaRecusandoLogin() throws IOException {
        assertRejected(verifier(gzip(largeCatalog("<div class=cf-turnstile></div>").getBytes(StandardCharsets.UTF_8)), "gzip"));
    }

    @Test void gzipTruncadoNaoLiberaAcessoMesmoComMarcadoresValidosNoInicio() throws IOException {
        byte[] compressed = gzip(MARKERS.getBytes(StandardCharsets.UTF_8));
        assertRejected(verifier(Arrays.copyOf(compressed, compressed.length - 8), "gzip"));
    }

    @Test void gzipInvalidoECodificacaoNaoSuportadaNaoLiberamAcesso() {
        assertRejected(verifier(MARKERS.getBytes(StandardCharsets.UTF_8), "gzip"));
        assertRejected(verifier(MARKERS.getBytes(StandardCharsets.UTF_8), "br"));
    }

    @Test void htmlDescompactadoAcimaDoLimiteNaoLiberaAcessoMesmoComDownloadPequeno() throws IOException {
        var output = new ByteArrayOutputStream();
        try (var gzip = new GZIPOutputStream(output)) {
            gzip.write(MARKERS.getBytes(StandardCharsets.UTF_8));
            byte[] padding = ("<p>" + "x".repeat(4096) + "</p>").getBytes(StandardCharsets.UTF_8);
            for (long count = 0; count <= HttpAreaCentralSessionVerifier.MAX_HTML_BYTES; count += padding.length) {
                gzip.write(padding);
            }
        }
        assertThat(output.size()).isLessThan(HttpAreaCentralSessionVerifier.MAX_DOWNLOAD_BYTES);
        assertRejected(verifier(output.toByteArray(), "gzip"));
    }

    @Test void downloadAcimaDoNovoLimiteContinuaSendoCanceladoAntesDoParser() {
        assertRejected(verifier(new byte[HttpAreaCentralSessionVerifier.MAX_DOWNLOAD_BYTES + 1], "identity"));
    }

    @Test void optionForaDoFiltroNaoSubstituiMarcadorAutenticado() {
        assertThatThrownBy(() -> HttpAreaCentralSessionVerifier.verifyDocument(
                "<select name=outro><option value=PF.REFERENCIA>Outro</option></select><div class=product-name>Teste</div>", jar))
                .isInstanceOf(AreaCentralIntegrationUnavailableException.class);
    }

    private static String largeCatalog(String suffix) {
        String filler = ("\n<p>" + "x".repeat(4096) + "</p>\n").repeat(1300);
        return "<!doctype html><html><body>" + MARKERS + filler + suffix + "</body></html>";
    }

    private static byte[] gzip(byte[] bytes) throws IOException {
        var output = new ByteArrayOutputStream();
        try (var gzip = new GZIPOutputStream(output)) { gzip.write(bytes); }
        return output.toByteArray();
    }

    private void assertRejected(HttpAreaCentralSessionVerifier verifier) {
        assertThatThrownBy(() -> verifier.verify(jar)).isInstanceOf(AreaCentralIntegrationUnavailableException.class)
                .hasNoCause().hasMessageNotContaining("cookie-ficticio-privado")
                .hasMessageNotContaining("<select").hasMessageNotContaining("<div");
    }

    /** Exercita o subscriber real, inclusive o limite durante o recebimento, sem portal/conta real. */
    @SuppressWarnings("unchecked")
    private HttpAreaCentralSessionVerifier verifier(byte[] bytes, String encoding) {
        HttpClient client = mock(HttpClient.class);
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenAnswer(call -> {
            HttpRequest request = call.getArgument(0);
            assertThat(request.uri()).isEqualTo(HttpAreaCentralSessionVerifier.CATALOG_URL);
            assertThat(request.headers().firstValue("Accept-Encoding")).contains("gzip");
            HttpHeaders headers = HttpHeaders.of(Map.of("Content-Type", List.of("text/html; charset=UTF-8"),
                    "Content-Encoding", List.of(encoding)), (a, b) -> true);
            HttpResponse.ResponseInfo info = mock(HttpResponse.ResponseInfo.class);
            when(info.statusCode()).thenReturn(200);
            when(info.headers()).thenReturn(headers);
            HttpResponse.BodyHandler<byte[]> handler = call.getArgument(1);
            HttpResponse.BodySubscriber<byte[]> subscriber = handler.apply(info);
            boolean[] cancelled = { false };
            subscriber.onSubscribe(new Flow.Subscription() {
                public void request(long count) {}
                public void cancel() { cancelled[0] = true; }
            });
            for (int offset = 0; offset < bytes.length && !cancelled[0]; offset += 64 * 1024) {
                subscriber.onNext(List.of(ByteBuffer.wrap(bytes, offset, Math.min(64 * 1024, bytes.length - offset))));
            }
            if (!cancelled[0]) subscriber.onComplete();
            return subscriber.getBody().toCompletableFuture().thenApply(body -> {
                HttpResponse<byte[]> response = mock(HttpResponse.class);
                when(response.statusCode()).thenReturn(200);
                when(response.headers()).thenReturn(headers);
                when(response.body()).thenReturn(body);
                return response;
            });
        });
        return new HttpAreaCentralSessionVerifier(client);
    }
}
