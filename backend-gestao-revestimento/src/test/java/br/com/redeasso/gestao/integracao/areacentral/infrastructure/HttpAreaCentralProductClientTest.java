package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.junit.jupiter.api.Test;
import java.net.http.*;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.*;
import java.io.ByteArrayOutputStream;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class HttpAreaCentralProductClientTest {
    static final String FILTER = "<select name='filtro[]'><option value='PF.REFERENCIA'>Referência</option></select>"
            + "<select name='operador[]'><option value='IGUAL'>Igual</option></select><input name='valor_filtro1[]' value='1234567'>";
    static final String CARD = """
            <div class=product-wrapper><div class=product-name>Piso fictício - 1xM2</div>
            <span>GTIN: 123, Ref: 1234567</span><span class=marcador data-codigo=''>PADRAO</span>
            <b>Estoque:</b> 1.234,56 <b>Múltiplo:</b> 2,10
            <span data-toggle=popover data-trigger=hover>R$ 10,50</span></div>
            """;
    final AreaCentralCookieJar jar = new AreaCentralCookieJar(List.of(new AreaCentralCookie(
            "PHPSESSID", "COOKIE_FICTICIO_PRIVADO", "redeasso.areacentral.com.br", "/", true, true, "lax", null)));

    @Test void extraiProdutoExatoSemConfundirValorComMultiploOuOutroProduto() {
        var result = HttpAreaCentralProductClient.parse(FILTER + CARD.replace("1234567", "9999999") + CARD, "1234567");
        assertThat(result.encontrado()).isTrue();
        assertThat(result.valorBrutoM2()).isEqualByComparingTo("10.50");
        assertThat(result.estoqueM2()).isEqualByComparingTo("1234.56");
        assertThat(result.status()).isEqualTo("PADRAO");
        assertThat(result.nome()).isEqualTo("Piso fictício");
        assertThat(result.m2PorCaixa()).isEqualByComparingTo("2.10");
    }
    @Test void extraiNomeSemGtinELinkDeFotoSeguroDoProdutoExato() {
        String card = CARD.replace("Piso fictício - 1xM2", "<div>PISO FICTÍCIO 62X122 RETIF - 1xM2</div><small>GTIN: 123</small>")
                .replace("<b>Estoque:","<img src='/fotos/piso.jpg'><b>Estoque:");
        var produto = HttpAreaCentralProductClient.parse(FILTER + card, "1234567");
        assertThat(produto.nome()).isEqualTo("PISO FICTÍCIO 62X122 RETIF");
        assertThat(produto.linkFoto()).isEqualTo("https://redeasso.areacentral.com.br/fotos/piso.jpg");
        assertThat(HttpAreaCentralProductClient.parse(FILTER + card.replace("PISO FICTÍCIO", "PISO <strong>FICTÍCIO</strong>"), "1234567").nome())
                .isEqualTo("PISO FICTÍCIO 62X122 RETIF");
        assertThat(HttpAreaCentralProductClient.parse(FILTER + card.replace("/fotos/piso.jpg","javascript:alert(1)"),"1234567").linkFoto()).isNull();
        assertThat(HttpAreaCentralProductClient.parse(FILTER + CARD.replace("<b>Múltiplo:</b> 2,10", ""),"1234567").m2PorCaixa()).isNull();
    }
    @Test void distingueZeroRealDeCampoAusente() {
        var result = HttpAreaCentralProductClient.parse(FILTER + CARD.replace("1.234,56", "0").replace("R$ 10,50", "R$ 0,00"), "1234567");
        assertThat(result.estoqueM2()).isZero();
        assertThat(result.valorBrutoM2()).isZero();
        for (String html : List.of(CARD.replace("<b>Estoque:</b>", "<b>Saldo:</b>"), CARD.replace("data-toggle=popover", "data-toggle=outro"))) {
            assertThatThrownBy(() -> HttpAreaCentralProductClient.parse(FILTER + html, "1234567"))
                    .isInstanceOf(AreaCentralProductException.class);
        }
    }
    @Test void soAusenciaExplicitaEmPaginaAutenticadaSignificaNaoEncontrado() {
        for (String message : List.of("Nenhum produto encontrado", "Nenhum produto nos catálogos abertos")) {
            assertThat(HttpAreaCentralProductClient.parse(FILTER + message, "1234567").encontrado()).isFalse();
        }
        for (String html : List.of("", FILTER, "Nenhum produto encontrado", FILTER + CARD.replace("1234567", "9999999"), FILTER + CARD + CARD)) {
            assertThatThrownBy(() -> HttpAreaCentralProductClient.parse(html, "1234567"))
                    .isInstanceOf(AreaCentralProductException.class);
        }
        assertThatThrownBy(() -> HttpAreaCentralProductClient.parse(FILTER.replace("value='1234567'", "value='outro'")
                + "Nenhum produto encontrado", "1234567")).isInstanceOf(AreaCentralProductException.class);
    }
    @Test void formularioEVerificacaoHumanaNuncaSaoProdutoInexistente() {
        for (String suffix : List.of("<input type=password>", "<div class=cf-turnstile></div>")) {
            assertThatThrownBy(() -> HttpAreaCentralProductClient.parse(FILTER + CARD + suffix, "1234567"))
                    .isInstanceOfSatisfying(AreaCentralProductException.class, error ->
                            assertThat(error.code()).isEqualTo(AreaCentralProductException.Code.SESSION_EXPIRED));
        }
    }
    @Test void numerosBrasileirosNaoUsamDoubleNemTrocamMilharPorDecimal() {
        assertThat(HttpAreaCentralProductClient.decimal("R$ 1.234,56")).isEqualByComparingTo("1234.56");
        assertThat(HttpAreaCentralProductClient.decimal("1.234")).isEqualByComparingTo("1234");
        assertThat(HttpAreaCentralProductClient.decimal("2.10")).isEqualByComparingTo("2.10");
        assertThat(HttpAreaCentralProductClient.decimal("\u00a02,10 m²")).isEqualByComparingTo("2.10");
        for (String invalid : List.of("N/D", "-1", "1,2,3", "1.000,1234567", "<script>0</script>")) {
            assertThatThrownBy(() -> HttpAreaCentralProductClient.decimal(invalid)).isInstanceOf(AreaCentralProductException.class);
        }
    }
    @Test @SuppressWarnings("unchecked")
    void usaPostFixoComFiltroCodificadoERecusaStatusSemVazarCookiesOuCorpo() {
        HttpClient client = mock(HttpClient.class);
        HttpResponse<byte[]> response = mock(HttpResponse.class);
        when(response.statusCode()).thenReturn(200);
        when(response.headers()).thenReturn(HttpHeaders.of(Map.of("Content-Type", List.of("text/html")), (a,b)->true));
        when(response.body()).thenReturn((FILTER + CARD).getBytes(StandardCharsets.UTF_8));
        when(client.sendAsync(any(HttpRequest.class), any(HttpResponse.BodyHandler.class))).thenAnswer(call -> {
            HttpRequest request = call.getArgument(0);
            assertThat(request.uri()).isEqualTo(HttpAreaCentralSessionVerifier.CATALOG_URL);
            assertThat(request.method()).isEqualTo("POST");
            var posted = new ByteArrayOutputStream();
            request.bodyPublisher().orElseThrow().subscribe(new Flow.Subscriber<ByteBuffer>() {
                public void onSubscribe(Flow.Subscription subscription) { subscription.request(Long.MAX_VALUE); }
                public void onNext(ByteBuffer bytes) { byte[] copy = new byte[bytes.remaining()]; bytes.get(copy); posted.writeBytes(copy); }
                public void onError(Throwable ignored) {} public void onComplete() {}
            });
            assertThat(posted.toString(StandardCharsets.UTF_8)).contains("filtro%5B%5D=PF.REFERENCIA", "operador%5B%5D=IGUAL", "valor_filtro1%5B%5D=1234567");
            return CompletableFuture.completedFuture(response);
        });
        var adapter = new HttpAreaCentralProductClient(client);
        assertThat(adapter.consultar("1234567", jar).encontrado()).isTrue();
        for (int status : List.of(302,401,403,404,429,500)) {
            when(response.statusCode()).thenReturn(status);
            assertThatThrownBy(() -> adapter.consultar("1234567", jar)).isInstanceOf(AreaCentralProductException.class)
                    .hasNoCause().hasMessageNotContaining("COOKIE_FICTICIO_PRIVADO").hasMessageNotContaining("<div");
        }
    }
}
