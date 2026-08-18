package br.com.redeasso.gestao.integracao.areacentral.application;

import java.time.Instant;

public record AreaCentralLoginAttemptState(
        String status,
        String interactiveUrl,
        Instant expiresAt) {

    public static AreaCentralLoginAttemptState waitingForUser(String interactiveUrl, Instant expiresAt) {
        return new AreaCentralLoginAttemptState("WAITING_FOR_USER", interactiveUrl, expiresAt);
    }
}
