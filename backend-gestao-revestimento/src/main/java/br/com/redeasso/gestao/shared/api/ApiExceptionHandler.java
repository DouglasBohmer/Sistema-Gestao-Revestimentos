package br.com.redeasso.gestao.shared.api;

import br.com.redeasso.gestao.auth.application.InvalidCredentialsException;
import br.com.redeasso.gestao.catalogo.application.PisoNaoEncontradoException;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralBrowserUnavailableException;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralIntegrationUnavailableException;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralLoginAttemptNotFoundException;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralLoginBusyException;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralLoginIncompleteException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(PisoNaoEncontradoException.class)
    public ResponseEntity<ApiError> pisoNotFound(
            PisoNaoEncontradoException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.NOT_FOUND,
                "PISO_NOT_FOUND",
                exception.getMessage(),
                request);
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    public ResponseEntity<ApiError> invalidCredentials(
            InvalidCredentialsException exception,
            HttpServletRequest request) {
        return response(
                HttpStatus.UNAUTHORIZED,
                "INVALID_CREDENTIALS",
                exception.getMessage(),
                request);
    }

    @ExceptionHandler({AreaCentralIntegrationUnavailableException.class, AreaCentralBrowserUnavailableException.class})
    public ResponseEntity<ApiError> areaCentralUnavailable(Exception exception, HttpServletRequest request) {
        return response(HttpStatus.SERVICE_UNAVAILABLE, "AREA_CENTRAL_UNAVAILABLE", exception.getMessage(), request);
    }

    @ExceptionHandler(AreaCentralLoginBusyException.class)
    public ResponseEntity<ApiError> areaCentralLoginBusy(
            AreaCentralLoginBusyException exception,
            HttpServletRequest request) {
        return response(HttpStatus.CONFLICT, "AREA_CENTRAL_LOGIN_BUSY", exception.getMessage(), request);
    }

    @ExceptionHandler(AreaCentralLoginIncompleteException.class)
    public ResponseEntity<ApiError> areaCentralLoginIncomplete(
            AreaCentralLoginIncompleteException exception,
            HttpServletRequest request) {
        return response(HttpStatus.CONFLICT, "AREA_CENTRAL_LOGIN_INCOMPLETE", exception.getMessage(), request);
    }

    @ExceptionHandler(AreaCentralLoginAttemptNotFoundException.class)
    public ResponseEntity<ApiError> areaCentralLoginNotFound(
            AreaCentralLoginAttemptNotFoundException exception,
            HttpServletRequest request) {
        return response(HttpStatus.NOT_FOUND, "AREA_CENTRAL_LOGIN_NOT_FOUND", exception.getMessage(), request);
    }

    @ExceptionHandler({
            MethodArgumentNotValidException.class,
            ConstraintViolationException.class,
            HttpMessageNotReadableException.class
    })
    public ResponseEntity<ApiError> invalidInput(Exception exception, HttpServletRequest request) {
        return response(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_ERROR",
                "Dados de entrada inválidos",
                request);
    }

    private static ResponseEntity<ApiError> response(
            HttpStatus status,
            String code,
            String message,
            HttpServletRequest request) {
        return ResponseEntity.status(status).body(ApiError.of(
                status.value(),
                code,
                message,
                request.getRequestURI()));
    }
}
