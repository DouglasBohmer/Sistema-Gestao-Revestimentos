package br.com.redeasso.gestao.mapa.api;

import br.com.redeasso.gestao.mapa.application.MapaException;
import br.com.redeasso.gestao.shared.api.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice(basePackageClasses = MapaController.class)
public class MapaExceptionHandler {

    @ExceptionHandler(MapaException.class)
    public ResponseEntity<ApiError> handle(MapaException exception, HttpServletRequest request) {
        var status = exception.getStatus();
        return ResponseEntity.status(status).body(ApiError.of(
                status.value(),
                exception.getCode(),
                exception.getMessage(),
                request.getRequestURI()));
    }
}
