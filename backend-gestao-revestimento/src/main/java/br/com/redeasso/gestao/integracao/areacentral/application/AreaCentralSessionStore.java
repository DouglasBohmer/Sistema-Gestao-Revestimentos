package br.com.redeasso.gestao.integracao.areacentral.application;

import java.util.Optional;

public interface AreaCentralSessionStore {

    void save(String applicationSessionId, AreaCentralCookieJar cookieJar);

    boolean hasSession(String applicationSessionId);

    Optional<AreaCentralCookieJar> find(String applicationSessionId);

    void remove(String applicationSessionId);
}
