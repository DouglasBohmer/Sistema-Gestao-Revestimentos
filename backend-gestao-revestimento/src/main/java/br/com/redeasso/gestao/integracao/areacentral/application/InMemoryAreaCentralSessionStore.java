package br.com.redeasso.gestao.integracao.areacentral.application;

import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * A expiração ao reiniciar a aplicação é intencional: as sessões externas não
 * devem virar dados persistentes nem sobreviver como cookies reutilizáveis.
 */
public class InMemoryAreaCentralSessionStore implements AreaCentralSessionStore {

    private final ConcurrentMap<String, AreaCentralCookieJar> sessions = new ConcurrentHashMap<>();

    @Override
    public void save(String applicationSessionId, AreaCentralCookieJar cookieJar) {
        sessions.put(applicationSessionId, cookieJar);
    }

    @Override
    public boolean hasSession(String applicationSessionId) {
        return applicationSessionId != null && sessions.containsKey(applicationSessionId);
    }

    @Override
    public Optional<AreaCentralCookieJar> find(String applicationSessionId) {
        return Optional.ofNullable(sessions.get(applicationSessionId));
    }

    @Override
    public void remove(String applicationSessionId) {
        if (applicationSessionId != null) {
            sessions.remove(applicationSessionId);
        }
    }
}
