package br.com.redeasso.gestao.shared.security;

import br.com.redeasso.gestao.shared.api.ApiError;
import br.com.redeasso.gestao.shared.api.ApiErrorResponseWriter;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
public class JsonAccessDeniedHandler implements AccessDeniedHandler {

    private final ApiErrorResponseWriter responseWriter;

    public JsonAccessDeniedHandler(ApiErrorResponseWriter responseWriter) {
        this.responseWriter = responseWriter;
    }

    @Override
    public void handle(
            HttpServletRequest request,
            HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException, ServletException {
        responseWriter.write(response, ApiError.of(
                HttpStatus.FORBIDDEN.value(),
                "ACCESS_DENIED",
                "Acesso negado",
                request.getRequestURI()));
    }
}
