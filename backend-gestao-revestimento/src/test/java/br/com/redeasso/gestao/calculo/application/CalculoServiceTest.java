package br.com.redeasso.gestao.calculo.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.calculo.api.CalculoResponse;
import br.com.redeasso.gestao.catalogo.application.PisoService;
import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CalculoServiceTest {

    private final PisoService pisoService = mock(PisoService.class);
    private final AtividadeService atividadeService = mock(AtividadeService.class);
    private final CalculoService calculoService = new CalculoService(pisoService, atividadeService);

    @Test
    void arredondaCaixasParaCimaECalculaPrecoPelosMetrosEfetivamenteVendidos() {
        Piso piso = piso("1.44", "89.90");
        when(pisoService.buscarPorCodigo("L-001")).thenReturn(piso);

        CalculoResponse resultado = calculoService.calcular(
                "L-001",
                new BigDecimal("45.5"),
                new BigDecimal("10"));

        assertThat(resultado.metragemComMargem()).isEqualByComparingTo("50.050000");
        assertThat(resultado.quantidadeCaixas()).isEqualTo(35);
        assertThat(resultado.valorTotal()).isEqualByComparingTo("4530.96");
        verify(atividadeService).registrar(
                "calculo",
                "Cálculo realizado para Piso de teste",
                "Piso de teste");
    }

    @Test
    void usaMargemPadraoDeDezPorCentoEPermitePisoSemPreco() {
        Piso piso = piso("2.00", null);
        when(pisoService.buscarPorCodigo("REDE-1")).thenReturn(piso);

        CalculoResponse resultado = calculoService.calcular(
                "REDE-1",
                new BigDecimal("10"),
                null);

        assertThat(resultado.margemQuebra()).isEqualByComparingTo("10");
        assertThat(resultado.quantidadeCaixas()).isEqualTo(6);
        assertThat(resultado.valorTotal()).isNull();
    }

    private static Piso piso(String m2PorCaixa, String valor) {
        return Piso.cadastrar(new DadosPiso(
                "Piso de teste",
                "REDE-1",
                "L-001",
                null,
                null,
                null,
                null,
                new BigDecimal(m2PorCaixa),
                null,
                null,
                null,
                null,
                null,
                null,
                valor == null ? null : new BigDecimal(valor)));
    }
}
