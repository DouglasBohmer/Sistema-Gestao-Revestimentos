package br.com.redeasso.gestao.integracao.areacentral.application;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/** Concessões transitórias, limitadas e nunca persistidas em claro no Neon. */
@Service
public class AreaCentralBrowserTransferService {
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Duration TTL = Duration.ofMinutes(10);
    private static final Set<String> COOKIE_NAMES = Set.of("PHPSESSID", "cf_clearance", "__cf_bm");
    private final AreaCentralProperties properties;
    private final AreaCentralSessionVerifier verifier;
    private final Clock clock;
    private final Map<String, Transfer> transfers = new HashMap<>();
    private final java.util.concurrent.Semaphore validations = new java.util.concurrent.Semaphore(2);

    @org.springframework.beans.factory.annotation.Autowired
    public AreaCentralBrowserTransferService(AreaCentralProperties properties, AreaCentralSessionVerifier verifier) {
        this(properties, verifier, Clock.systemUTC());
    }

    AreaCentralBrowserTransferService(AreaCentralProperties properties, AreaCentralSessionVerifier verifier, Clock clock) {
        this.properties = properties;
        this.verifier = verifier;
        this.clock = clock;
    }

    public synchronized Grant start(String sessionId) {
        if (!properties.enabled()) throw new AreaCentralIntegrationUnavailableException("A integração com a Área Central não está habilitada");
        expire();
        if (transfers.size() >= 100 && !transfers.containsKey(sessionId)) throw new AreaCentralLoginBusyException();
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Transfer transfer = new Transfer(token, clock.instant().plus(TTL));
        transfers.put(sessionId, transfer); // Reiniciar revoga a concessão anterior.
        return new Grant(token, transfer.expiresAt);
    }

    public void receive(String token, List<AreaCentralCookie> cookies) {
        Transfer transfer;
        synchronized (this) {
            expire();
            transfer = transfers.values().stream().filter(item -> item.token.equals(token)).findFirst()
                    .orElseThrow(AreaCentralLoginAttemptNotFoundException::new);
            if (!"WAITING_FOR_BROWSER".equals(transfer.status)) throw new AreaCentralLoginIncompleteException();
            transfer.status = "VALIDATING"; // Consome a concessão antes de qualquer I/O; sem replay/concorrência.
        }
        if (!validations.tryAcquire()) {
            synchronized (this) { transfer.status = "REJECTED"; }
            throw new AreaCentralLoginBusyException();
        }
        try {
            AreaCentralAuthenticatedLogin verified = verifier.verify(sanitize(cookies));
            synchronized (this) {
                if (transfer.expiresAt.isAfter(clock.instant()) && transfers.containsValue(transfer)) {
                    transfer.login = verified;
                    transfer.status = "READY_TO_COMPLETE";
                }
            }
        } catch (RuntimeException exception) {
            synchronized (this) { transfer.status = "REJECTED"; }
            throw exception;
        } finally {
            validations.release();
        }
    }

    public synchronized State current(String sessionId) {
        Transfer transfer = get(sessionId);
        return new State(transfer.status, transfer.expiresAt);
    }

    public synchronized AreaCentralAuthenticatedLogin complete(String sessionId) {
        Transfer transfer = get(sessionId);
        if (!"READY_TO_COMPLETE".equals(transfer.status) || transfer.login == null) throw new AreaCentralLoginIncompleteException();
        transfers.remove(sessionId);
        return transfer.login;
    }

    public synchronized void cancel(String sessionId) { transfers.remove(sessionId); }

    @Scheduled(fixedDelay = 60_000)
    public synchronized void expire() {
        transfers.values().removeIf(transfer -> !transfer.expiresAt.isAfter(clock.instant()));
    }

    private Transfer get(String sessionId) {
        expire();
        Transfer transfer = transfers.get(sessionId);
        if (transfer == null) throw new AreaCentralLoginAttemptNotFoundException();
        return transfer;
    }

    private AreaCentralCookieJar sanitize(List<AreaCentralCookie> cookies) {
        if (cookies == null || cookies.isEmpty() || cookies.size() > 6) throw new AreaCentralLoginIncompleteException();
        Set<String> names = new HashSet<>();
        List<AreaCentralCookie> clean = new ArrayList<>();
        for (AreaCentralCookie cookie : cookies) {
            String domain = cookie.domain() == null ? "" : cookie.domain().replaceFirst("^\\.", "");
            if (!COOKIE_NAMES.contains(cookie.name()) || !names.add(cookie.name())
                    || !Set.of("redeasso.areacentral.com.br", "areacentral.com.br").contains(domain)
                    || !"/".equals(cookie.path()) || cookie.value().length() > 4096
                    || cookie.value().chars().anyMatch(c -> c < 0x21 || c >= 0x7f || ";,\"\\".indexOf(c) >= 0)
                    || (cookie.expiresAt() != null && !cookie.expiresAt().isAfter(clock.instant()))) {
                throw new AreaCentralLoginIncompleteException();
            }
            clean.add(cookie);
        }
        AreaCentralCookieJar jar = new AreaCentralCookieJar(clean);
        if (!jar.hasAuthenticatedSessionCookie()) throw new AreaCentralLoginIncompleteException();
        return jar;
    }

    public record Grant(String transferToken, Instant expiresAt) {
        @Override public String toString() { return "Grant[redacted]"; }
    }
    public record State(String status, Instant expiresAt) {}
    private static final class Transfer {
        final String token;
        final Instant expiresAt;
        String status = "WAITING_FOR_BROWSER";
        AreaCentralAuthenticatedLogin login;
        Transfer(String token, Instant expiresAt) { this.token = token; this.expiresAt = expiresAt; }
    }
}
