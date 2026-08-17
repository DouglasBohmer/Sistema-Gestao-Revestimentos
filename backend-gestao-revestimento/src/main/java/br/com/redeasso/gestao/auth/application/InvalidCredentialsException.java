package br.com.redeasso.gestao.auth.application;

public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Usuário ou senha inválidos");
    }
}
