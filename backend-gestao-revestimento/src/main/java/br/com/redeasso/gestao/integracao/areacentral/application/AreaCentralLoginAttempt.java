package br.com.redeasso.gestao.integracao.areacentral.application;

import java.time.Instant;

final class AreaCentralLoginAttempt {

    private final String applicationSessionId;
    private final String browserSessionId;
    private final String interactiveAccessId;
    private final String username;
    private final Instant expiresAt;

    AreaCentralLoginAttempt(
            String applicationSessionId,
            String browserSessionId,
            String interactiveAccessId,
            String username,
            Instant expiresAt) {
        this.applicationSessionId = applicationSessionId;
        this.browserSessionId = browserSessionId;
        this.interactiveAccessId = interactiveAccessId;
        this.username = username;
        this.expiresAt = expiresAt;
    }

    String applicationSessionId() {
        return applicationSessionId;
    }

    String browserSessionId() {
        return browserSessionId;
    }

    String interactiveAccessId() {
        return interactiveAccessId;
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
