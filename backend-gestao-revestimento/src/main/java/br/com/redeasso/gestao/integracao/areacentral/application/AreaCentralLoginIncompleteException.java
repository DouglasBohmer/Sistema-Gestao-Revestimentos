package br.com.redeasso.gestao.integracao.areacentral.application;

public class AreaCentralLoginIncompleteException extends RuntimeException {

    public AreaCentralLoginIncompleteException() {
        super("O login ainda não foi identificado. Conclua o acesso e o CAPTCHA na janela da Área Central antes de confirmar.");
    }
}
