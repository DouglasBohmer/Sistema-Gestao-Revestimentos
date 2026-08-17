package br.com.redeasso.gestao.auth.api;

import br.com.redeasso.gestao.auth.api.dto.LocalLoginRequest;
import br.com.redeasso.gestao.auth.api.dto.SessionResponse;
import br.com.redeasso.gestao.auth.application.LocalAuthenticationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth/local")
@ConditionalOnProperty(
        prefix = "redeasso.auth.local",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class LocalAuthController {

    private final LocalAuthenticationService authenticationService;

    public LocalAuthController(LocalAuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @PostMapping("/login")
    public ResponseEntity<SessionResponse> login(
            @Valid @RequestBody LocalLoginRequest loginRequest,
            HttpServletRequest request,
            HttpServletResponse response) {
        Authentication authentication = authenticationService.authenticate(
                loginRequest.username(),
                loginRequest.password(),
                request,
                response);

        return ResponseEntity.ok(SessionResponse.local(authentication.getName()));
    }
}
