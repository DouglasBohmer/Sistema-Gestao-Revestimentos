package br.com.redeasso.gestao.integracao.areacentral.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Identifica a conta localmente; a senha é digitada somente no Chrome isolado. */
public record StartAreaCentralLoginRequest(
        @NotBlank @Size(max = 160) String username) {

    @Override
    public String toString() {
        return "StartAreaCentralLoginRequest[username=%s]".formatted(username);
    }
}
