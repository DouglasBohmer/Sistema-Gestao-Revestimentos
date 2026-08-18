package br.com.redeasso.gestao.integracao.areacentral.application;

import java.time.Instant;

final class AreaCentralLoginAttempt {

    private final String applicationSessionId;
    private final String browserSessionId;
    private final Instant expiresAt;

    AreaCentralLoginAttempt(String applicationSessionId, String browserSessionId, Instant expiresAt) {
        this.applicationSessionId = applicationSessionId;
        this.browserSessionId = browserSessionId;
        this.expiresAt = expiresAt;
    }

    String applicationSessionId() {
        return applicationSessionId;
    }

    String browserSessionId() {
        return browserSessionId;
    }

    Instant expiresAt() {
        return expiresAt;
    }

    boolean expiredAt(Instant instant) {
        return !expiresAt.isAfter(instant);
    }
}
