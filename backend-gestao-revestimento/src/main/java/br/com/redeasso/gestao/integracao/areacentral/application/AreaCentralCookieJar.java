package br.com.redeasso.gestao.integracao.areacentral.application;

import java.util.List;

/**
 * Jar opaco e efêmero. Nunca deve ser serializado para a sessão JDBC, banco,
 * resposta HTTP ou log.
 */
public final class AreaCentralCookieJar {

    private static final String REQUIRED_SESSION_COOKIE = "PHPSESSID";

    private final List<AreaCentralCookie> cookies;

    public AreaCentralCookieJar(List<AreaCentralCookie> cookies) {
        this.cookies = List.copyOf(cookies);
    }

    public boolean hasAuthenticatedSessionCookie() {
        return cookies.stream()
                .anyMatch(cookie -> REQUIRED_SESSION_COOKIE.equalsIgnoreCase(cookie.name()));
    }

    public List<AreaCentralCookie> cookies() {
        return cookies;
    }

    @Override
    public String toString() {
        return "AreaCentralCookieJar[cookies=%d]".formatted(cookies.size());
    }
}
