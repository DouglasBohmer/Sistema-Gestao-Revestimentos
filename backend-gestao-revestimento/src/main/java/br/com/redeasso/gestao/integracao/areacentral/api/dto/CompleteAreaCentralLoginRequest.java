package br.com.redeasso.gestao.integracao.areacentral.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CompleteAreaCentralLoginRequest(
        @NotBlank @Size(max = 160) String username) {
}
