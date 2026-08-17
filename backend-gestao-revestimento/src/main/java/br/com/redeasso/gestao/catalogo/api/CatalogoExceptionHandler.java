package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.application.PisoEmUsoException;
import br.com.redeasso.gestao.catalogo.application.PisoNaoEncontradoException;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Order(Ordered.HIGHEST_PRECEDENCE)
@RestControllerAdvice(assignableTypes = PisoController.class)
public class CatalogoExceptionHandler {

    @ExceptionHandler(PisoNaoEncontradoException.class)
    public ResponseEntity<ErrorResponse> pisoNaoEncontrado(PisoNaoEncontradoException exception) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler(PisoEmUsoException.class)
    public ResponseEntity<ErrorResponse> pisoEmUso(PisoEmUsoException exception) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
                .body(new ErrorResponse(exception.getMessage()));
    }

    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            ConstraintViolationException.class,
            HttpMessageNotReadableException.class,
            IllegalArgumentException.class
    })
    public ResponseEntity<ErrorResponse> entradaInvalida(Exception exception) {
        return ResponseEntity.badRequest().body(new ErrorResponse("Dados de entrada inválidos"));
    }

    public record ErrorResponse(String error) {
    }
}
