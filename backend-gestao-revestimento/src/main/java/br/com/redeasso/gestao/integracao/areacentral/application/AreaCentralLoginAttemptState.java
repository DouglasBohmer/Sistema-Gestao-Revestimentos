package br.com.redeasso.gestao.integracao.areacentral.application;

import java.time.Instant;

public record AreaCentralLoginAttemptState(
        String status,
        String interactiveUrl,
        Instant expiresAt) {

    public static AreaCentralLoginAttemptState waitingForHuman(String interactiveUrl, Instant expiresAt) {
        return new AreaCentralLoginAttemptState("WAITING_FOR_HUMAN", interactiveUrl, expiresAt);
    }

    public static AreaCentralLoginAttemptState readyToComplete(String interactiveUrl, Instant expiresAt) {
        return new AreaCentralLoginAttemptState("READY_TO_COMPLETE", interactiveUrl, expiresAt);
    }
}
