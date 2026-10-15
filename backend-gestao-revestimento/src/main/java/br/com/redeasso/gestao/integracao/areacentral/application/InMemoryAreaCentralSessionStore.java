package br.com.redeasso.gestao.integracao.areacentral.application;

import java.util.Optional;
import java.time.Instant;
import java.time.Duration;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Fallback de desenvolvimento sem chave de criptografia. Expira em 12 horas
 * ou no reinício; produção usa o envelope criptografado na sessão JDBC.
 */
public class InMemoryAreaCentralSessionStore implements AreaCentralSessionStore {

    private record Entry(AreaCentralCookieJar jar, Instant expiresAt) {}
    private final ConcurrentMap<String, Entry> sessions = new ConcurrentHashMap<>();

    @Override
    public void save(String applicationSessionId, AreaCentralCookieJar cookieJar) {
        sessions.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(Instant.now()));
        sessions.put(applicationSessionId, new Entry(cookieJar, Instant.now().plus(Duration.ofHours(12))));
    }

    @Override
    public boolean hasSession(String applicationSessionId) {
        return find(applicationSessionId).isPresent();
    }

    @Override
    public Optional<AreaCentralCookieJar> find(String applicationSessionId) {
        if (applicationSessionId == null) return Optional.empty();
        Entry entry = sessions.get(applicationSessionId);
        if (entry == null) return Optional.empty();
        if (!entry.expiresAt().isAfter(Instant.now())) {
            sessions.remove(applicationSessionId, entry);
            return Optional.empty();
        }
        return Optional.of(entry.jar());
    }

    @Override
    public void remove(String applicationSessionId) {
        if (applicationSessionId != null) {
            sessions.remove(applicationSessionId);
        }
    }
}
