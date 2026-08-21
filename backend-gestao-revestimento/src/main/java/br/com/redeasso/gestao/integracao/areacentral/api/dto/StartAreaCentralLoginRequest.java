package br.com.redeasso.gestao.integracao.areacentral.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** Credenciais efêmeras: não registrar, não persistir e não devolver na API. */
public record StartAreaCentralLoginRequest(
        @NotBlank @Size(max = 160) String username,
        @NotBlank @Size(max = 512) String password) {

    @Override
    public String toString() {
        return "StartAreaCentralLoginRequest[username=%s, password=[REDACTED]]".formatted(username);
    }
}
