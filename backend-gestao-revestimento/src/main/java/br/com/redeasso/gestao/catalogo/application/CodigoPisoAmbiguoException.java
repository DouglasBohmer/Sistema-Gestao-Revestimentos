package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.catalogo.domain.Piso;

import java.util.List;

public class CodigoPisoAmbiguoException extends RuntimeException {

    private final List<Piso> opcoes;

    public CodigoPisoAmbiguoException(List<Piso> opcoes) {
        super("Mais de um produto foi encontrado para o código informado");
        this.opcoes = List.copyOf(opcoes);
    }

    public List<Piso> getOpcoes() {
        return opcoes;
    }
}
