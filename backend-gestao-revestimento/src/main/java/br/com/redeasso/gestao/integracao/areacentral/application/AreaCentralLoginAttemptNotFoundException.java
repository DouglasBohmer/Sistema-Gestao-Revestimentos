package br.com.redeasso.gestao.integracao.areacentral.application;

public class AreaCentralLoginAttemptNotFoundException extends RuntimeException {

    public AreaCentralLoginAttemptNotFoundException() {
        super("Não há uma verificação da Área Central em andamento nesta sessão");
    }
}
