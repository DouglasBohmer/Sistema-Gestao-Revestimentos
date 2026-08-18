package br.com.redeasso.gestao.integracao.areacentral.api.dto;

import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralLoginAttemptState;

import java.time.Instant;

public record AreaCentralLoginAttemptResponse(
        String status,
        String interactiveUrl,
        Instant expiresAt) {

    public static AreaCentralLoginAttemptResponse from(AreaCentralLoginAttemptState state) {
        return new AreaCentralLoginAttemptResponse(
                state.status(),
                state.interactiveUrl(),
                state.expiresAt());
    }
}
