package br.com.redeasso.gestao.integracao.areacentral.application;

public class AreaCentralLoginBusyException extends RuntimeException {

    public AreaCentralLoginBusyException() {
        super("Já existe uma verificação da Área Central em andamento. Aguarde ou cancele-a antes de iniciar outra.");
    }
}
