package br.com.redeasso.gestao.integracao.areacentral.application;

import java.time.Instant;

final class AreaCentralLoginAttempt {

    private final String applicationSessionId;
    private final String browserSessionId;
    private final String username;
    private final Instant expiresAt;

    AreaCentralLoginAttempt(String applicationSessionId, String browserSessionId, String username, Instant expiresAt) {
        this.applicationSessionId = applicationSessionId;
        this.browserSessionId = browserSessionId;
        this.username = username;
        this.expiresAt = expiresAt;
    }

    String applicationSessionId() {
        return applicationSessionId;
    }

    String browserSessionId() {
        return browserSessionId;
    }

    String username() {
        return username;
    }

    Instant expiresAt() {
        return expiresAt;
    }

    boolean expiredAt(Instant instant) {
        return !expiresAt.isAfter(instant);
    }
}
