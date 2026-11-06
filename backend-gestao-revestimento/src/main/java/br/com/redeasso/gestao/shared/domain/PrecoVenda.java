package br.com.redeasso.gestao.shared.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Objects;

/** Arredondamento comercial do preço unitário por m², nunca do total do pedido. */
public final class PrecoVenda {
    private PrecoVenda() {}

    public static BigDecimal arredondar(BigDecimal valor) {
        Objects.requireNonNull(valor, "valor obrigatório");
        if (valor.signum() < 0) throw new IllegalArgumentException("Preço não pode ser negativo");
        BigDecimal centavos = valor.setScale(2, RoundingMode.HALF_UP);
        BigDecimal inteiro = centavos.setScale(0, RoundingMode.DOWN);
        BigDecimal fracao = centavos.subtract(inteiro);
        BigDecimal ajuste = fracao.compareTo(new BigDecimal("0.20")) <= 0 ? BigDecimal.ZERO
                : fracao.compareTo(new BigDecimal("0.50")) <= 0 ? new BigDecimal("0.50")
                : fracao.compareTo(new BigDecimal("0.75")) <= 0 ? new BigDecimal("0.75") : BigDecimal.ONE;
        return inteiro.add(ajuste).setScale(2);
    }
}
