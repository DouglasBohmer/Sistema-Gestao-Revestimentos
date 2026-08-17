package br.com.redeasso.gestao.shared.api;

import java.time.Instant;

public record ApiError(
        int status,
        String code,
        String message,
        String path,
        Instant timestamp) {

    public static ApiError of(int status, String code, String message, String path) {
        return new ApiError(status, code, message, path, Instant.now());
    }
}
