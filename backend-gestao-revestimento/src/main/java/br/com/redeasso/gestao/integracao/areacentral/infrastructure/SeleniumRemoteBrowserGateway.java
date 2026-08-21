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

/** Adaptador WebDriver W3C do contêiner Selenium, sem dependência de GUI no Spring. */
@Component
public class SeleniumRemoteBrowserGateway implements AreaCentralBrowserGateway {

    private static final String W3C_ELEMENT_ID = "element-6066-11e4-a52e-4f735466cecf";
    private static final String USERNAME_SELECTOR = "#USR_APELIDO";
    private static final String PASSWORD_SELECTOR = "#USR_SENHA";

    private final AreaCentralProperties properties;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;

    public SeleniumRemoteBrowserGateway(AreaCentralProperties properties, ObjectMapper objectMapper) {
        this.properties = properties;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    @Override
    public AreaCentralBrowserSession open(URI loginUrl, String username, char[] password) {
        ObjectNode capability = objectMapper.createObjectNode();
        capability.put("browserName", "chrome");
        capability.putObject("goog:chromeOptions").putArray("args");
        ObjectNode payload = objectMapper.createObjectNode();
        payload.putObject("capabilities").set("alwaysMatch", capability);

        JsonNode response = send("POST", "/session", payload);
        String browserSessionId = response.path("value").path("sessionId").asText();
        if (browserSessionId.isBlank()) {
            browserSessionId = response.path("sessionId").asText();
        }
        if (browserSessionId.isBlank()) {
            throw new AreaCentralBrowserUnavailableException();
        }

        try {
            ObjectNode navigation = objectMapper.createObjectNode();
            navigation.put("url", loginUrl.toString());
            send("POST", "/session/%s/url".formatted(browserSessionId), navigation);
            fillCredentials(browserSessionId, username, password);
            return new AreaCentralBrowserSession(browserSessionId);
        } catch (RuntimeException exception) {
            close(browserSessionId);
            throw exception;
        }
    }

    private void fillCredentials(String browserSessionId, String username, char[] password) {
        type(browserSessionId, USERNAME_SELECTOR, username);
        type(browserSessionId, PASSWORD_SELECTOR, new String(password));
    }

    private void type(String browserSessionId, String selector, String value) {
        ObjectNode findPayload = objectMapper.createObjectNode();
        findPayload.put("using", "css selector");
        findPayload.put("value", selector);
        JsonNode element = send("POST", "/session/%s/element".formatted(browserSessionId), findPayload)
                .path("value");
        String elementId = element.path(W3C_ELEMENT_ID).asText();
        if (elementId.isBlank()) {
            elementId = element.path("ELEMENT").asText();
        }
        if (elementId.isBlank()) {
            throw new AreaCentralBrowserUnavailableException();
        }

        ObjectNode keysPayload = objectMapper.createObjectNode();
        keysPayload.put("text", value);
        var values = keysPayload.putArray("value");
        value.codePoints().forEach(codePoint -> values.add(new String(Character.toChars(codePoint))));
        send("POST", "/session/%s/element/%s/value".formatted(browserSessionId, elementId), keysPayload);
    }

    @Override
    public List<AreaCentralCookie> cookies(String browserSessionId) {
        JsonNode response = send("GET", "/session/%s/cookie".formatted(browserSessionId), null);
        JsonNode values = response.path("value");
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
                    expiry(value.path("expiry"))));
        }
        return List.copyOf(cookies);
    }

    @Override
    public boolean loginFormDisplayed(String browserSessionId) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("script", """
                return Boolean(document.querySelector(
                  'input[type=\"password\"], input[name*=\"senha\" i], input[name*=\"password\" i]'
                ));
                """);
        payload.putArray("args");

        JsonNode response = send("POST", "/session/%s/execute/sync".formatted(browserSessionId), payload);
        return response.path("value").asBoolean(false);
    }

    @Override
    public void close(String browserSessionId) {
        try {
            send("DELETE", "/session/%s".formatted(browserSessionId), null);
        } catch (AreaCentralBrowserUnavailableException ignored) {
            // A sessão será descartada pelo próprio Selenium quando ele voltar a ficar disponível.
        }
    }

    private JsonNode send(String method, String path, JsonNode body) {
        try {
            HttpRequest.Builder request = HttpRequest.newBuilder(endpoint(path))
                    .timeout(properties.readTimeout())
                    .header("Accept", "application/json");
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
            return objectMapper.readTree(response.body());
        } catch (IOException exception) {
            throw new AreaCentralBrowserUnavailableException(exception);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new AreaCentralBrowserUnavailableException(exception);
        }
    }

    private URI endpoint(String path) {
        return URI.create(properties.webDriverUrl().toString().replaceAll("/+$", "") + path);
    }

    private static Instant expiry(JsonNode value) {
        return value.canConvertToLong() ? Instant.ofEpochSecond(value.asLong()) : null;
    }

    private static String nullIfBlank(String value) {
        return value == null || value.isBlank() ? null : value;
    }
}
