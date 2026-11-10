package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Element;
import org.jsoup.nodes.Node;
import org.jsoup.nodes.TextNode;
import org.springframework.stereotype.Component;
import org.slf4j.LoggerFactory;

import java.io.*;
import java.math.BigDecimal;
import java.net.URLEncoder;
import java.net.http.*;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import static br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductException.Code.*;

/** Porta HTTP do EstoqueScraper: busca filtrada, sem arquivo global de cookies ou navegador no servidor. */
@Component
public final class HttpAreaCentralProductClient implements AreaCentralProductClient {
    private static final org.slf4j.Logger LOGGER = LoggerFactory.getLogger(HttpAreaCentralProductClient.class);
    private static final int MAX_DOWNLOAD = 2 * 1024 * 1024;
    private static final int MAX_HTML = 4 * 1024 * 1024;
    private static final Pattern REFERENCE = Pattern.compile("(?:Refer[êe]ncia|Ref)\\s*:\\s*([\\p{L}\\p{N}._/-]+)", Pattern.CASE_INSENSITIVE);
    private final HttpClient client;
    @org.springframework.beans.factory.annotation.Autowired
    public HttpAreaCentralProductClient(AreaCentralProperties properties) {
        this(HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).followRedirects(HttpClient.Redirect.NEVER).build());
    }
    HttpAreaCentralProductClient(HttpClient client) { this.client = client; }

    @Override public Product consultar(String codigo, AreaCentralCookieJar jar) {
        if (!jar.hasAuthenticatedSessionCookie()) throw new AreaCentralProductException(SESSION_REQUIRED);
        String body = "filtrar=%23&limit-filtro=10&filtro%5B%5D=PF.REFERENCIA&operador%5B%5D=IGUAL&valor_filtro1%5B%5D="
                + URLEncoder.encode(codigo, StandardCharsets.UTF_8);
        String cookieHeader = jar.cookies().stream().map(cookie -> cookie.name() + "=" + cookie.value())
                .collect(java.util.stream.Collectors.joining("; "));
        var request = HttpRequest.newBuilder(HttpAreaCentralSessionVerifier.CATALOG_URL).timeout(Duration.ofSeconds(10))
                .header("Accept", "text/html").header("Accept-Encoding", "gzip")
                .header("Content-Type", "application/x-www-form-urlencoded")
                .header("Cookie", cookieHeader).POST(HttpRequest.BodyPublishers.ofString(body)).build();
        CompletableFuture<HttpResponse<byte[]>> pending = null;
        long started = System.nanoTime();
        AtomicInteger upstreamStatus = new AtomicInteger();
        try {
            pending = client.sendAsync(request, info -> {
                upstreamStatus.set(info.statusCode());
                return new HttpAreaCentralSessionVerifier.LimitedBodySubscriber(MAX_DOWNLOAD);
            });
            var response = pending.get(12, TimeUnit.SECONDS);
            int status = response.statusCode();
            upstreamStatus.set(status);
            if (status == 401 || (status >= 300 && status < 400)) throw new AreaCentralProductException(SESSION_EXPIRED);
            if (status != 200) throw new AreaCentralProductException(UPSTREAM_UNAVAILABLE);
            if (!response.headers().firstValue("Content-Type").orElse("").toLowerCase(Locale.ROOT).contains("text/html")) {
                throw new AreaCentralProductException(INVALID_RESPONSE);
            }
            if (response.body().length > MAX_DOWNLOAD) throw new AreaCentralProductException(INVALID_RESPONSE);
            String encoding = response.headers().firstValue("Content-Encoding").orElse("identity").trim();
            InputStream input = new ByteArrayInputStream(response.body());
            if ("gzip".equalsIgnoreCase(encoding)) input = new GZIPInputStream(input);
            else if (!encoding.isEmpty() && !"identity".equalsIgnoreCase(encoding)) throw new AreaCentralProductException(INVALID_RESPONSE);
            try (InputStream decoded = input) {
                byte[] html = decoded.readNBytes(MAX_HTML + 1);
                if (html.length > MAX_HTML) throw new AreaCentralProductException(INVALID_RESPONSE);
                return parse(new String(html, StandardCharsets.UTF_8), codigo);
            }
        } catch (AreaCentralProductException exception) {
            logFailure(exception.code(), upstreamStatus.get(), started);
            throw exception;
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            logFailure(UPSTREAM_UNAVAILABLE, upstreamStatus.get(), started);
            throw new AreaCentralProductException(UPSTREAM_UNAVAILABLE);
        } catch (Exception ignored) {
            // Não expor corpo, cookies, cabeçalhos, mensagem externa ou causa da exceção.
            logFailure(UPSTREAM_UNAVAILABLE, upstreamStatus.get(), started);
            throw new AreaCentralProductException(UPSTREAM_UNAVAILABLE);
        } finally { if (pending != null) pending.cancel(true); }
    }

    static Product parse(String html, String codigo) {
        var document = Jsoup.parse(html, HttpAreaCentralSessionVerifier.CATALOG_URL.toString());
        if (document.selectFirst("#form-login,#USR_SENHA,input[type=password],.cf-turnstile") != null) {
            throw new AreaCentralProductException(SESSION_EXPIRED);
        }
        if (document.selectFirst("select[name=\"filtro[]\"] option[value=\"PF.REFERENCIA\"]") == null) {
            throw new AreaCentralProductException(INVALID_RESPONSE);
        }
        var matches = document.select(".product-wrapper").stream().filter(card -> {
            // ownText evita concatenar a referência com o status de um span irmão ("1234567PADRAO").
            for (Element part : card.getAllElements()) {
                var reference = REFERENCE.matcher(part.ownText());
                while (reference.find()) if (codigo.equals(reference.group(1))) return true;
            }
            return false;
        }).toList();
        if (matches.size() != 1) {
            String text = document.text().toLowerCase(Locale.ROOT);
            Element field = document.selectFirst("select[name=\"filtro[]\"]");
            Element operator = document.selectFirst("select[name=\"operador[]\"]");
            Element value = document.selectFirst("input[name=\"valor_filtro1[]\"]");
            boolean filtered = "PF.REFERENCIA".equals(selectedValue(field))
                    && "IGUAL".equals(selectedValue(operator)) && value != null && codigo.equals(value.val());
            if (matches.isEmpty() && document.select(".product-wrapper").isEmpty()
                    && filtered
                    && (text.contains("nenhum produto encontrado") || text.contains("nenhum registro encontrado")
                    || text.contains("nenhum produto nos catálogos abertos"))) return Product.naoEncontrado();
            throw new AreaCentralProductException(INVALID_RESPONSE);
        }
        Element card = matches.getFirst();
        var price = card.selectFirst("span[data-toggle=popover][data-trigger=hover]");
        var status = card.selectFirst("span.marcador[data-codigo=\"\"]");
        if (price == null || status == null || status.text().isBlank() || status.text().length() > 100
                || card.selectFirst(".product-name") == null) {
            throw new AreaCentralProductException(INVALID_RESPONSE);
        }
        Element name = card.selectFirst(".product-name > div:first-child");
        if (name == null) name = card.selectFirst(".product-name");
        String nome = name.text().trim();
        nome = nome.replaceFirst("(?i)\\s*-\\s*1\\s*x\\s*M[²2]\\s*$", "").trim();
        if (nome.isEmpty() || nome.length() > 200) nome = null;
        BigDecimal multiplo = null;
        try {
            multiplo = decimal(label(card, "Múltiplo:"));
            if (multiplo.signum() <= 0) multiplo = null;
        } catch (AreaCentralProductException ignored) {
            // Dado técnico opcional: sua ausência não impede consultar estoque/preço.
        }
        Element image = card.selectFirst(".product-image img, img.product-image, img");
        String foto = null;
        if (image != null) {
            String source = image.hasAttr("data-src") ? image.absUrl("data-src") : image.absUrl("src");
            try {
                var uri = java.net.URI.create(source);
                if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                        && uri.getRawUserInfo() == null && source.length() <= 2048) foto = source;
            } catch (IllegalArgumentException ignored) { /* Nunca devolver URL executável ou inválida. */ }
        }
        return new Product(true, decimal(price.text()), decimal(label(card, "Estoque:")), status.text().trim(),
                nome, multiplo, foto);
    }

    private static String label(Element card, String name) {
        for (Element label : card.select("b")) if (name.equalsIgnoreCase(label.text().trim())) {
            for (Node next = label.nextSibling(); next != null; next = next.nextSibling()) {
                String value = next instanceof Element element ? element.text() : next instanceof TextNode text ? text.text() : "";
                if (!value.isBlank()) return value;
            }
        }
        throw new AreaCentralProductException(INVALID_RESPONSE);
    }

    private static String selectedValue(Element select) {
        if (select == null) return "";
        Element option = select.selectFirst("option[selected]");
        if (option == null) option = select.selectFirst("option");
        return option == null ? "" : option.attr("value");
    }

    static BigDecimal decimal(String value) {
        String normalized = value.replace("R$", "").replace("m²", "").replace("\u00a0", "").trim();
        if (normalized.length() > 32) throw new AreaCentralProductException(INVALID_RESPONSE);
        if (normalized.matches("\\d+(?:\\.\\d{3})*(?:,\\d{1,6})?")) normalized = normalized.replace(".", "").replace(',', '.');
        else if (!normalized.matches("\\d+(?:\\.\\d{1,6})?")) throw new AreaCentralProductException(INVALID_RESPONSE);
        BigDecimal number = new BigDecimal(normalized);
        if (number.precision() - number.scale() > 12 || number.scale() > 6) throw new AreaCentralProductException(INVALID_RESPONSE);
        return number;
    }
    private static void logFailure(AreaCentralProductException.Code code, int status, long started) {
        LOGGER.warn("area_central_product_query_failed reason={} upstream_status={} duration_ms={}", code,
                status >= 100 && status <= 599 ? status : "unavailable", TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - started));
    }
}
