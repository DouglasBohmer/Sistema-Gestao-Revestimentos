package br.com.redeasso.gestao.mapa.application;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MapaQuantidadeCalculatorTest {

    @Test
    void calculaCaixasPelosMetrosQuadradosSempreArredondandoParaCima() {
        var quantidade = MapaQuantidadeCalculator.calcular(
                new BigDecimal("2.89"),
                new BigDecimal("99"),
                new BigDecimal("1.44"));

        assertThat(quantidade.m2()).isEqualByComparingTo("2.89");
        assertThat(quantidade.caixas()).isEqualTo(3);
    }

    @Test
    void calculaMetrosQuadradosPelasCaixasComDuasCasas() {
        var quantidade = MapaQuantidadeCalculator.calcular(
                BigDecimal.ZERO,
                new BigDecimal("2.1"),
                new BigDecimal("1.445"));

        assertThat(quantidade.caixas()).isEqualTo(3);
        assertThat(quantidade.m2()).isEqualByComparingTo("4.34");
        assertThat(quantidade.m2()).hasScaleOf(2);
    }

    @Test
    void rejeitaValoresNegativosMesmoQuandoAOutraQuantidadeEPositiva() {
        assertThatThrownBy(() -> MapaQuantidadeCalculator.calcular(
                new BigDecimal("-1"),
                new BigDecimal("2"),
                new BigDecimal("1.44")))
                .isInstanceOf(MapaException.class)
                .hasMessage("m² e caixas não podem ser negativos");
    }

    @Test
    void rejeitaItemSemNenhumaQuantidadePositiva() {
        assertThatThrownBy(() -> MapaQuantidadeCalculator.calcular(
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                new BigDecimal("1.44")))
                .isInstanceOf(MapaException.class)
                .hasMessage("Informe os m² ou a quantidade de caixas para cada piso");
    }
}
