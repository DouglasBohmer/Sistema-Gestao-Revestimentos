package br.com.redeasso.gestao.catalogo.application;

public class PisoNomeDuplicadoException extends RuntimeException {

    public PisoNomeDuplicadoException() {
        super("Já existe um produto com esse nome");
    }
}
