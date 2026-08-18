package br.com.redeasso.gestao.integracao.areacentral.application;

import java.time.Instant;
import java.util.Objects;

/** Cookie externo mantido somente na memória do processo. */
public final class AreaCentralCookie {

    private final String name;
    private final String value;
    private final String domain;
    private final String path;
    private final boolean secure;
    private final boolean httpOnly;
    private final String sameSite;
    private final Instant expiresAt;

    public AreaCentralCookie(
            String name,
            String value,
            String domain,
            String path,
            boolean secure,
            boolean httpOnly,
            String sameSite,
            Instant expiresAt) {
        this.name = requireText(name, "name");
        this.value = requireText(value, "value");
        this.domain = domain;
        this.path = path;
        this.secure = secure;
        this.httpOnly = httpOnly;
        this.sameSite = sameSite;
        this.expiresAt = expiresAt;
    }

    public String name() {
        return name;
    }

    public String value() {
        return value;
    }

    public String domain() {
        return domain;
    }

    public String path() {
        return path;
    }

    public boolean secure() {
        return secure;
    }

    public boolean httpOnly() {
        return httpOnly;
    }

    public String sameSite() {
        return sameSite;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    @Override
    public String toString() {
        return "AreaCentralCookie[name=%s, domain=%s]".formatted(name, domain);
    }

    private static String requireText(String value, String field) {
        Objects.requireNonNull(value, field + " é obrigatório");
        if (value.isBlank()) {
            throw new IllegalArgumentException(field + " é obrigatório");
        }
        return value;
    }
}
