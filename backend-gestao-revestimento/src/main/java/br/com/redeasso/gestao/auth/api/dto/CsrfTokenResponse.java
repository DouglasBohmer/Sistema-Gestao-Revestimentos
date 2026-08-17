package br.com.redeasso.gestao.auth.api.dto;

public record CsrfTokenResponse(
        String token,
        String headerName,
        String parameterName) {
}
