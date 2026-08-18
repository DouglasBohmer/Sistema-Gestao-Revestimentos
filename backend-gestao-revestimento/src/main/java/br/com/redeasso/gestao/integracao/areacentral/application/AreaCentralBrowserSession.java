package br.com.redeasso.gestao.integracao.areacentral.application;

import java.util.Objects;

public record AreaCentralBrowserSession(String id) {

    public AreaCentralBrowserSession {
        Objects.requireNonNull(id, "id é obrigatório");
        if (id.isBlank()) {
            throw new IllegalArgumentException("id da sessão do navegador é obrigatório");
        }
    }
}
