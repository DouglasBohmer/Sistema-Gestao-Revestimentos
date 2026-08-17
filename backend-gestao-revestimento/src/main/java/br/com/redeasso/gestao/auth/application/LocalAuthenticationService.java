package br.com.redeasso.gestao.auth.application;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(
        prefix = "redeasso.auth.local",
        name = "enabled",
        havingValue = "true",
        matchIfMissing = true)
public class LocalAuthenticationService {

    private final AuthenticationManager authenticationManager;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;

    public LocalAuthenticationService(
            AuthenticationManager authenticationManager,
            SecurityContextRepository securityContextRepository,
            SessionAuthenticationStrategy sessionAuthenticationStrategy) {
        this.authenticationManager = authenticationManager;
        this.securityContextRepository = securityContextRepository;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
    }

    public Authentication authenticate(
            String username,
            String password,
            HttpServletRequest request,
            HttpServletResponse response) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(username, password));

            sessionAuthenticationStrategy.onAuthentication(authentication, request, response);

            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            securityContextRepository.saveContext(context, request, response);

            HttpSession session = request.getSession(true);
            session.setAttribute(AuthSessionAttributes.AUTH_TYPE, "LOCAL");
            session.setAttribute(AuthSessionAttributes.AREA_CENTRAL_CONNECTED, Boolean.FALSE);

            return authentication;
        } catch (AuthenticationException exception) {
            SecurityContextHolder.clearContext();
            throw new InvalidCredentialsException();
        }
    }
}
