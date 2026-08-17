package br.com.redeasso.gestao.catalogo.application;

public class PisoEmUsoException extends RuntimeException {

    public PisoEmUsoException(Throwable cause) {
        super("Piso não pode ser excluído porque está vinculado a um mapa", cause);
    }
}
