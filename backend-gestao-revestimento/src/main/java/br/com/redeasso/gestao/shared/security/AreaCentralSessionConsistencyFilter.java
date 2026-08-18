package br.com.redeasso.gestao.shared.security;

import br.com.redeasso.gestao.auth.application.AuthSessionAttributes;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralSessionStore;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * The Área Central cookie jar is deliberately in-memory.  A persisted Spring
 * session therefore cannot remain authenticated as an external user after an
 * application restart, because its external session no longer exists.
 */
final class AreaCentralSessionConsistencyFilter extends OncePerRequestFilter {

    private static final String AREA_CENTRAL = "AREA_CENTRAL";

    private final AreaCentralSessionStore areaCentralSessionStore;

    AreaCentralSessionConsistencyFilter(AreaCentralSessionStore areaCentralSessionStore) {
        this.areaCentralSessionStore = areaCentralSessionStore;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        HttpSession session = request.getSession(false);
        if (isAreaCentralSessionWithoutCookieJar(session)) {
            session.invalidate();
            SecurityContextHolder.clearContext();
        }
        filterChain.doFilter(request, response);
    }

    private boolean isAreaCentralSessionWithoutCookieJar(HttpSession session) {
        return session != null
                && AREA_CENTRAL.equals(session.getAttribute(AuthSessionAttributes.AUTH_TYPE))
                && !areaCentralSessionStore.hasSession(session.getId());
    }
}
