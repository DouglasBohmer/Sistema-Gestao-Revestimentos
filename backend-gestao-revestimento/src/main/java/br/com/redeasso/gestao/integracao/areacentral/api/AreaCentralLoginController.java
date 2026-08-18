package br.com.redeasso.gestao.integracao.areacentral.api;

import br.com.redeasso.gestao.auth.api.dto.SessionResponse;
import br.com.redeasso.gestao.auth.application.AreaCentralAuthenticationService;
import br.com.redeasso.gestao.integracao.areacentral.api.dto.AreaCentralLoginAttemptResponse;
import br.com.redeasso.gestao.integracao.areacentral.api.dto.CompleteAreaCentralLoginRequest;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralCookieJar;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralLoginAttemptState;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralLoginService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/area-central")
public class AreaCentralLoginController {

    private final AreaCentralLoginService loginService;
    private final AreaCentralAuthenticationService authenticationService;

    public AreaCentralLoginController(
            AreaCentralLoginService loginService,
            AreaCentralAuthenticationService authenticationService) {
        this.loginService = loginService;
        this.authenticationService = authenticationService;
    }

    @PostMapping("/attempts")
    public ResponseEntity<AreaCentralLoginAttemptResponse> start(HttpServletRequest request) {
        AreaCentralLoginAttemptState state = loginService.start(sessionId(request));
        return ResponseEntity.status(201).body(AreaCentralLoginAttemptResponse.from(state));
    }

    @PostMapping("/attempts/complete")
    public ResponseEntity<SessionResponse> complete(
            @Valid @RequestBody CompleteAreaCentralLoginRequest completion,
            HttpServletRequest request,
            HttpServletResponse response) {
        AreaCentralCookieJar cookieJar = loginService.complete(sessionId(request));
        Authentication authentication = authenticationService.authenticateOrAttach(
                completion.username(), cookieJar, request, response);

        return ResponseEntity.ok(new SessionResponse(
                true,
                authentication.getName(),
                authType(request),
                true));
    }

    @DeleteMapping("/attempts/current")
    public ResponseEntity<Void> cancel(HttpServletRequest request) {
        loginService.cancel(sessionId(request));
        return ResponseEntity.noContent().build();
    }

    private static String sessionId(HttpServletRequest request) {
        return request.getSession(true).getId();
    }

    private static String authType(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        Object value = session == null ? null : session.getAttribute("redeasso.auth.type");
        return value instanceof String authType ? authType : "AREA_CENTRAL";
    }
}
