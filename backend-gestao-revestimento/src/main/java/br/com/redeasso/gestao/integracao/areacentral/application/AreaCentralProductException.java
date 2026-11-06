package br.com.redeasso.gestao.integracao.areacentral.application;

public final class AreaCentralProductException extends RuntimeException {
    public enum Code { SESSION_REQUIRED, SESSION_EXPIRED, BUSY, UPSTREAM_UNAVAILABLE, INVALID_RESPONSE, PRODUCT_CHANGED }
    private final Code code;
    public AreaCentralProductException(Code code) {
        super(switch (code) {
            case SESSION_REQUIRED, SESSION_EXPIRED -> "Conecte novamente a Área Central para atualizar preço e estoque.";
            case BUSY -> "A Área Central já está sendo consultada. Tente novamente em instantes.";
            case PRODUCT_CHANGED -> "O código do piso foi alterado durante a consulta. Tente novamente.";
            default -> "Não foi possível consultar a Área Central. Os últimos valores foram preservados.";
        });
        this.code = code;
    }
    public Code code() { return code; }
}
