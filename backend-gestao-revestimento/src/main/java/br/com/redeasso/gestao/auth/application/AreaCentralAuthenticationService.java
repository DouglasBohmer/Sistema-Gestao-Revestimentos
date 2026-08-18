package br.com.redeasso.gestao.auth.application;

import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralCookieJar;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralSessionStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AreaCentralAuthenticationService {

    private final AreaCentralSessionStore areaCentralSessionStore;
    private final SecurityContextRepository securityContextRepository;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;

    public AreaCentralAuthenticationService(
            AreaCentralSessionStore areaCentralSessionStore,
            SecurityContextRepository securityContextRepository,
            SessionAuthenticationStrategy sessionAuthenticationStrategy) {
        this.areaCentralSessionStore = areaCentralSessionStore;
        this.securityContextRepository = securityContextRepository;
        this.sessionAuthenticationStrategy = sessionAuthenticationStrategy;
    }

    public Authentication authenticateOrAttach(
            String username,
            AreaCentralCookieJar cookieJar,
            HttpServletRequest request,
            HttpServletResponse response) {
        HttpSession previousSession = request.getSession(true);
        String previousSessionId = previousSession.getId();
        Authentication currentAuthentication = SecurityContextHolder.getContext().getAuthentication();

        Authentication authentication;
        if (isAuthenticated(currentAuthentication)) {
            authentication = currentAuthentication;
        } else {
            authentication = UsernamePasswordAuthenticationToken.authenticated(
                    username,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_USER")));
            sessionAuthenticationStrategy.onAuthentication(authentication, request, response);

            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
            securityContextRepository.saveContext(context, request, response);
        }

        HttpSession currentSession = request.getSession(true);
        currentSession.setAttribute(AuthSessionAttributes.AREA_CENTRAL_CONNECTED, Boolean.TRUE);
        if (!isAuthenticated(currentAuthentication)) {
            currentSession.setAttribute(AuthSessionAttributes.AUTH_TYPE, "AREA_CENTRAL");
        }

        areaCentralSessionStore.save(currentSession.getId(), cookieJar);
        if (!previousSessionId.equals(currentSession.getId())) {
            areaCentralSessionStore.remove(previousSessionId);
        }
        return authentication;
    }

    private static boolean isAuthenticated(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && !(authentication instanceof AnonymousAuthenticationToken);
    }
}
