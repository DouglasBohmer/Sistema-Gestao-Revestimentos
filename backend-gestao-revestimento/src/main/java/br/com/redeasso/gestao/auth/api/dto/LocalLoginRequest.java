package br.com.redeasso.gestao.auth.api.dto;

import jakarta.validation.constraints.NotBlank;

public record LocalLoginRequest(
        @NotBlank(message = "O usuário é obrigatório") String username,
        @NotBlank(message = "A senha é obrigatória") String password) {
}
