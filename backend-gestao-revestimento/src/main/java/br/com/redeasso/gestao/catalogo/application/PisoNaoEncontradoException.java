package br.com.redeasso.gestao.catalogo.application;

public class PisoNaoEncontradoException extends RuntimeException {

    public PisoNaoEncontradoException() {
        super("Piso não encontrado");
    }
}
