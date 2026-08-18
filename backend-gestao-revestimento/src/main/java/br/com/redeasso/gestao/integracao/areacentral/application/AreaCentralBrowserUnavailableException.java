package br.com.redeasso.gestao.integracao.areacentral.application;

public class AreaCentralBrowserUnavailableException extends RuntimeException {

    public AreaCentralBrowserUnavailableException() {
        super("O navegador assistido da Área Central não está disponível");
    }

    public AreaCentralBrowserUnavailableException(Throwable cause) {
        super("O navegador assistido da Área Central não está disponível", cause);
    }
}
