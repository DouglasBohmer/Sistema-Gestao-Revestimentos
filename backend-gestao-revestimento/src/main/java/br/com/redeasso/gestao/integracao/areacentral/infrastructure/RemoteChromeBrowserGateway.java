package br.com.redeasso.gestao.integracao.areacentral.infrastructure;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralBrowserGateway;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralBrowserSession;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralBrowserUnavailableException;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralCookie;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Cliente do gateway privado do Chrome gráfico. O gateway abre a página de
 * login e lê somente o estado/cookies após a interação humana; ele nunca
 * recebe a senha nem emula a confirmação anti-bot.
 */
@Component
public class RemoteChromeBrowserGateway implements AreaCentralBrowserGateway {

    private final AreaCentralProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public RemoteChromeBrowserGateway(AreaCentralProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Override
    public AreaCentralBrowserSession open(URI loginUrl, String interactiveAccessId, Instant expiresAt) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("loginUrl", loginUrl.toString());
        payload.put("accessId", interactiveAccessId);
        payload.put("expiresAt", expiresAt.toString());
        String browserSessionId = send("POST", "/internal/browser/open", payload).path("id").asText();
        if (browserSessionId.isBlank()) {
            throw new AreaCentralBrowserUnavailableException();
        }
        return new AreaCentralBrowserSession(browserSessionId);
    }

    @Override
    public List<AreaCentralCookie> cookies(String browserSessionId) {
        JsonNode values = send("GET", "/internal/browser/%s/cookies".formatted(browserSessionId), null)
                .path("cookies");
        if (!values.isArray()) {
            throw new AreaCentralBrowserUnavailableException();
        }

        List<AreaCentralCookie> cookies = new ArrayList<>();
        for (JsonNode value : values) {
            String name = value.path("name").asText();
            String cookieValue = value.path("value").asText();
            if (name.isBlank() || cookieValue.isBlank()) {
                continue;
            }
            cookies.add(new AreaCentralCookie(
                    name,
                    cookieValue,
                    nullIfBlank(value.path("domain").asText()),
                    nullIfBlank(value.path("path").asText()),
                    value.path("secure").asBoolean(false),
                    value.path("httpOnly").asBoolean(false),
                    nullIfBlank(value.path("sameSite").asText()),
                    expiry(value.path("expires"))));
        }
        return List.copyOf(cookies);
    }

    @Override
    public boolean loginFormDisplayed(String browserSessionId) {
        return send("GET", "/internal/browser/%s/login-form".formatted(browserSessionId), null)
                .path("displayed")
                .asBoolean(false);
    }

    @Override
    public void revokeInteractiveAccess(String interactiveAccessId) {
        try {
            send("DELETE", "/internal/access/" + interactiveAccessId, null);
        } catch (AreaCentralBrowserUnavailableException ignored) {
            // A concessão é curta e o encerramento da sessão remove o estado local.
        }
    }

    @Override
    public void close(String browserSessionId) {
        try {
            send("DELETE", "/internal/browser/%s/session".formatted(browserSessionId), null);
        } catch (AreaCentralBrowserUnavailableException ignored) {
            // O gateway remove cookies antes de permitir a próxima tentativa.
        }
    }

    private JsonNode send(String method, String path, JsonNode body) {
        URI endpoint = properties.browserGatewayUrl().resolve("/" + path.replaceFirst("^/+", ""));
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(endpoint)
                    .timeout(properties.readTimeout())
                    .header("Accept", "application/json")
                    .header("X-Redeasso-Browser-Key", properties.browserServiceKey());
            if (body != null) {
                request.header("Content-Type", "application/json")
                        .method(method, HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(body)));
            } else {
                request.method(method, HttpRequest.BodyPublishers.noBody());
            }

            HttpResponse<String> response = httpClient.send(request.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new AreaCentralBrowserUnavailableException();
            }
            if (response.body() == null || response.body().isBlank()) {
                return objectMapper.createObjectNode();
            }
            return objectMapper.readTree(response.body());
        } catch (IOException exception) {
            throw new AreaCentralBrowserUnavailableException(exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AreaCentralBrowserUnavailableException(exception);
        }
    }

    private static Instant expiry(JsonNode value) {
        if (!value.isNumber() || value.asDouble() <= 0) {
            return null;
        }
        return Instant.ofEpochSecond((long) value.asDouble());
    }

    private static String nullIfBlank(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
