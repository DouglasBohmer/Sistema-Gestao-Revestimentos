package br.com.redeasso.gestao.integracao.areacentral.application;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import jakarta.annotation.PreDestroy;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class AreaCentralLoginService {

    private final AreaCentralProperties properties;
    private final AreaCentralBrowserGateway browserGateway;
    private final Map<String, AreaCentralLoginAttempt> attempts = new HashMap<>();

    public AreaCentralLoginService(
            AreaCentralProperties properties,
            AreaCentralBrowserGateway browserGateway) {
        this.properties = properties;
        this.browserGateway = browserGateway;
    }

    public synchronized AreaCentralLoginAttemptState start(
            String applicationSessionId,
            String username) {
        validateConfiguration();
        expireAttempts();

        AreaCentralLoginAttempt currentAttempt = attempts.get(applicationSessionId);
        if (currentAttempt != null) {
            return stateOf(currentAttempt);
        }
        if (!attempts.isEmpty()) {
            throw new AreaCentralLoginBusyException();
        }

        Instant expiresAt = Instant.now().plus(properties.loginAttemptTimeout());
        String interactiveAccessId = UUID.randomUUID().toString();
        AreaCentralBrowserSession browserSession = browserGateway.open(
                properties.loginUrl(), interactiveAccessId, expiresAt);
        AreaCentralLoginAttempt attempt = new AreaCentralLoginAttempt(
                applicationSessionId,
                browserSession.id(),
                interactiveAccessId,
                username,
                expiresAt);
        attempts.put(applicationSessionId, attempt);
        return stateOf(attempt);
    }

    public synchronized AreaCentralAuthenticatedLogin complete(String applicationSessionId) {
        expireAttempts();
        AreaCentralLoginAttempt attempt = attemptFor(applicationSessionId);
        AreaCentralCookieJar cookieJar = authenticatedCookieJar(attempt);
        if (cookieJar == null) {
            throw new AreaCentralLoginIncompleteException();
        }
        removeAttempt(attempt);
        return new AreaCentralAuthenticatedLogin(attempt.username(), cookieJar);
    }

    public synchronized AreaCentralLoginAttemptState current(String applicationSessionId) {
        expireAttempts();
        return stateOf(attemptFor(applicationSessionId));
    }

    public synchronized void cancel(String applicationSessionId) {
        AreaCentralLoginAttempt attempt = attempts.get(applicationSessionId);
        if (attempt != null) {
            removeAttempt(attempt);
        }
    }

    @Scheduled(fixedDelay = 60_000)
    public synchronized void expireAttempts() {
        Instant now = Instant.now();
        List<AreaCentralLoginAttempt> expired = attempts.values().stream()
                .filter(attempt -> attempt.expiredAt(now))
                .toList();
        expired.forEach(this::removeAttempt);
    }

    @PreDestroy
    public synchronized void closeAllBrowsers() {
        List<AreaCentralLoginAttempt> active = List.copyOf(attempts.values());
        active.forEach(this::removeAttempt);
    }

    private AreaCentralLoginAttempt attemptFor(String applicationSessionId) {
        AreaCentralLoginAttempt attempt = attempts.get(applicationSessionId);
        if (attempt == null) {
            throw new AreaCentralLoginAttemptNotFoundException();
        }
        return attempt;
    }

    private AreaCentralLoginAttemptState stateOf(AreaCentralLoginAttempt attempt) {
        String interactiveUrl = AreaCentralInteractiveAccessToken.issue(
                properties.interactiveUrl(),
                properties.interactiveTokenSecret(),
                attempt.interactiveAccessId(),
                attempt.expiresAt());
        if (authenticatedCookieJar(attempt) != null) {
            return AreaCentralLoginAttemptState.readyToComplete(interactiveUrl, attempt.expiresAt());
        }
        return AreaCentralLoginAttemptState.waitingForHuman(interactiveUrl, attempt.expiresAt());
    }

    private AreaCentralCookieJar authenticatedCookieJar(AreaCentralLoginAttempt attempt) {
        AreaCentralCookieJar cookieJar = new AreaCentralCookieJar(browserGateway.cookies(attempt.browserSessionId()));
        if (!cookieJar.hasAuthenticatedSessionCookie()
                || browserGateway.loginFormDisplayed(attempt.browserSessionId())) {
            return null;
        }
        return cookieJar;
    }

    private void removeAttempt(AreaCentralLoginAttempt attempt) {
        attempts.remove(attempt.applicationSessionId());
        browserGateway.revokeInteractiveAccess(attempt.interactiveAccessId());
        browserGateway.close(attempt.browserSessionId());
    }

    private void validateConfiguration() {
        if (!properties.enabled()) {
            throw new AreaCentralIntegrationUnavailableException(
                    "A integração com a Área Central não está habilitada neste ambiente");
        }
        if (properties.interactiveUrl() == null || properties.interactiveUrl().isBlank()) {
            throw new AreaCentralIntegrationUnavailableException(
                    "A URL segura do navegador assistido não está configurada");
        }
        if (properties.browserServiceKey() == null || properties.browserServiceKey().isBlank()
                || properties.interactiveTokenSecret() == null || properties.interactiveTokenSecret().isBlank()) {
            throw new AreaCentralIntegrationUnavailableException(
                    "As credenciais seguras do navegador assistido não estão configuradas");
        }
    }
}
