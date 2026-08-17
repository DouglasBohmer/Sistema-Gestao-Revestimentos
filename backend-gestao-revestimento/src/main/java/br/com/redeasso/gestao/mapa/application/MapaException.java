package br.com.redeasso.gestao.mapa.application;

import org.springframework.http.HttpStatus;

public class MapaException extends RuntimeException {

    private final HttpStatus status;
    private final String code;

    private MapaException(HttpStatus status, String code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public static MapaException naoEncontrado() {
        return new MapaException(HttpStatus.NOT_FOUND, "MAPA_NOT_FOUND", "Mapa não encontrado");
    }

    public static MapaException entradaInvalida(String message) {
        return new MapaException(HttpStatus.BAD_REQUEST, "MAPA_VALIDATION_ERROR", message);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }
}
