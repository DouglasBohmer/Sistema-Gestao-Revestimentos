package br.com.redeasso.gestao.shared.domain;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import java.math.BigDecimal;
import static org.assertj.core.api.Assertions.*;

class PrecoVendaTest {
    @ParameterizedTest
    @CsvSource({"0,0.00","15.00,15.00","15.20,15.00","15.21,15.50","15.50,15.50","15.51,15.75",
            "15.75,15.75","15.76,16.00","15.95,16.00","15.99,16.00","15.2049,15.00","15.205,15.50",
            "15.5049,15.50","15.505,15.75","15.7549,15.75","15.755,16.00","74.43744,74.50"})
    void aplicaFaixasDepoisDaPrecisaoMonetaria(String valor, String esperado) {
        assertThat(PrecoVenda.arredondar(new BigDecimal(valor))).isEqualByComparingTo(esperado);
    }
    @Test void rejeitaNegativoENulo() {
        assertThatThrownBy(()->PrecoVenda.arredondar(new BigDecimal("-0.01"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(()->PrecoVenda.arredondar(null)).isInstanceOf(NullPointerException.class);
    }
    @Test void reaplicarNaoMudaPrecoNemAlteraOrdem() {
        BigDecimal anterior = BigDecimal.ZERO;
        for (int centavos=0;centavos<=10000;centavos++) {
            var atual = PrecoVenda.arredondar(BigDecimal.valueOf(centavos,2));
            assertThat(atual).isGreaterThanOrEqualTo(anterior);
            assertThat(PrecoVenda.arredondar(atual)).isEqualTo(atual);
            anterior = atual;
        }
    }
}
