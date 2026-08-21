package br.com.redeasso.gestao.integracao.areacentral.application;

import java.util.Objects;

/** Resultado interno do login externo; nunca deve ser serializado diretamente. */
public record AreaCentralAuthenticatedLogin(String username, AreaCentralCookieJar cookieJar) {

    public AreaCentralAuthenticatedLogin {
        Objects.requireNonNull(username, "username é obrigatório");
        Objects.requireNonNull(cookieJar, "cookieJar é obrigatório");
    }

    @Override
    public String toString() {
        return "AreaCentralAuthenticatedLogin[authenticated]";
    }
}
