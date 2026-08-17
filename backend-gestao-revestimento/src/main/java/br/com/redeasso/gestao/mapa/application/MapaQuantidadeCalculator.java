package br.com.redeasso.gestao.mapa.application;

import java.math.BigDecimal;
import java.math.RoundingMode;

final class MapaQuantidadeCalculator {

    private static final BigDecimal ZERO = BigDecimal.ZERO;

    private MapaQuantidadeCalculator() {
    }

    static Quantidade calcular(BigDecimal m2Recebido, BigDecimal caixasRecebidas, BigDecimal m2PorCaixa) {
        if ((m2Recebido != null && m2Recebido.signum() < 0)
                || (caixasRecebidas != null && caixasRecebidas.signum() < 0)) {
            throw MapaException.entradaInvalida("m² e caixas não podem ser negativos");
        }
        var m2 = valorOuZero(m2Recebido);
        var caixasDecimal = valorOuZero(caixasRecebidas).setScale(0, RoundingMode.CEILING);

        if (m2.signum() <= 0 && caixasDecimal.signum() <= 0) {
            throw MapaException.entradaInvalida("Informe os m² ou a quantidade de caixas para cada piso");
        }

        try {
            int caixas;
            if (m2PorCaixa != null && m2PorCaixa.signum() > 0) {
                if (m2.signum() > 0) {
                    caixas = m2.divide(m2PorCaixa, 0, RoundingMode.CEILING).intValueExact();
                } else {
                    caixas = caixasDecimal.intValueExact();
                    m2 = m2PorCaixa.multiply(BigDecimal.valueOf(caixas)).setScale(2, RoundingMode.HALF_UP);
                }
            } else {
                caixas = caixasDecimal.intValueExact();
            }
            return new Quantidade(m2, caixas);
        } catch (ArithmeticException exception) {
            throw MapaException.entradaInvalida("Quantidade fora do limite permitido");
        }
    }

    private static BigDecimal valorOuZero(BigDecimal valor) {
        return valor == null ? ZERO : valor;
    }

    record Quantidade(BigDecimal m2, int caixas) {
    }
}
