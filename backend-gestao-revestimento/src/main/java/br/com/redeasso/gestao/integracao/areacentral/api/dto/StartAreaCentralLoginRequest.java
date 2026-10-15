package br.com.redeasso.gestao.integracao.areacentral.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.fasterxml.jackson.annotation.JsonProperty;

/** Credenciais transitórias: nunca registrar ou devolver a senha. */
public record StartAreaCentralLoginRequest(
        @NotBlank @Size(max = 160) String username,
        @JsonProperty(access = JsonProperty.Access.WRITE_ONLY) @Size(min = 1, max = 1024) String password) {

    public StartAreaCentralLoginRequest(String username) {
        this(username, null);
    }

    @Override
    public String toString() {
        return "StartAreaCentralLoginRequest[credentials=REDACTED]";
    }
}
