package br.com.redeasso.gestao.configuracao.application;
public class StatusConfiguracaoInvalidaException extends RuntimeException {
    public StatusConfiguracaoInvalidaException(){super("Informe uma cor válida para cada um dos cinco status, sem repetir status");}
}
