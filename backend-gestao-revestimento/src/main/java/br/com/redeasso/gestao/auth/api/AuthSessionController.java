package br.com.redeasso.gestao.auth.api;

import br.com.redeasso.gestao.auth.api.dto.CsrfTokenResponse;
import br.com.redeasso.gestao.auth.api.dto.SessionResponse;
import br.com.redeasso.gestao.auth.application.AuthSessionAttributes;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralSessionStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthSessionController {

    private final AreaCentralSessionStore areaCentralSessionStore;

    public AuthSessionController(AreaCentralSessionStore areaCentralSessionStore) {
        this.areaCentralSessionStore = areaCentralSessionStore;
    }

    @GetMapping("/session")
    public ResponseEntity<SessionResponse> session(
            Authentication authentication,
            HttpServletRequest request) {
        if (!isAuthenticated(authentication)) {
            return ResponseEntity.ok(SessionResponse.anonymous());
        }

        HttpSession session = request.getSession(false);
        String authType = sessionAttribute(session, AuthSessionAttributes.AUTH_TYPE, String.class);
        boolean areaCentralConnected = session != null
                && areaCentralSessionStore.hasSession(session.getId());

        return ResponseEntity.ok(new SessionResponse(
                true,
                authentication.getName(),
                authType,
                areaCentralConnected));
    }

    @GetMapping("/csrf")
    public ResponseEntity<CsrfTokenResponse> csrf(CsrfToken csrfToken) {
        return ResponseEntity.ok(new CsrfTokenResponse(
                csrfToken.getToken(),
                csrfToken.getHeaderName(),
                csrfToken.getParameterName()));
    }

    private static boolean isAuthenticated(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }

    private static <T> T sessionAttribute(HttpSession session, String name, Class<T> type) {
        if (session == null) {
            return null;
        }

        Object value = session.getAttribute(name);
        return type.isInstance(value) ? type.cast(value) : null;
    }
}
