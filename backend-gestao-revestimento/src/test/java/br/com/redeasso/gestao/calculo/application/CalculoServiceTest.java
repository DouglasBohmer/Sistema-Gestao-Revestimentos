package br.com.redeasso.gestao.calculo.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.calculo.api.CalculoResponse;
import br.com.redeasso.gestao.catalogo.application.PisoService;
import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import br.com.redeasso.gestao.configuracao.domain.ParametroSistema;
import br.com.redeasso.gestao.configuracao.infrastructure.ParametroSistemaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.ArgumentMatchers.any;

class CalculoServiceTest {

    private final PisoService pisoService = mock(PisoService.class);
    private final AtividadeService atividadeService = mock(AtividadeService.class);
    private final ParametroSistemaRepository parametroSistemaRepository = mock(ParametroSistemaRepository.class);
    private final CalculoService calculoService = new CalculoService(
            pisoService,
            atividadeService,
            parametroSistemaRepository);

    @BeforeEach
    void setUp() {
        configurarParametros("20", "3", "9", "1.8", "1");
    }

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
        assertThat(resultado.metragemVendidaM2()).isEqualByComparingTo("50.400000");
        assertThat(resultado.quantidadeSacosArgamassa()).isEqualTo(17);
        assertThat(resultado.pesoArgamassaKg()).isEqualByComparingTo("336.000000");
        assertThat(resultado.quantidadeEmbalagensRejunte()).isNull();
        assertThat(resultado.pesoRejunteKg()).isNull();
        assertThat(resultado.quantidadeNiveladores()).isNull();
        assertThat(resultado.quantidadePacotesNiveladores()).isNull();
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

    @Test
    void mantemQuantidadeExataDeCaixasECalculaMateriaisComParametrosPersistidos() {
        configurarParametros("25", "4", "10", "2", "0.5");
        Piso piso = piso("2.00", "10.00", "50", "50", "2");
        when(pisoService.buscarPorCodigo("REDE-1")).thenReturn(piso);

        CalculoResponse resultado = calculoService.calcular(
                null,
                "REDE-1",
                null,
                3L,
                new BigDecimal("25"));

        assertThat(resultado.metragemM2()).isEqualByComparingTo("6.000000");
        assertThat(resultado.margemQuebra()).isEqualByComparingTo("0");
        assertThat(resultado.metragemComMargem()).isEqualByComparingTo("6.000000");
        assertThat(resultado.quantidadeCaixas()).isEqualTo(3);
        assertThat(resultado.metragemVendidaM2()).isEqualByComparingTo("6.000000");
        assertThat(resultado.quantidadeSacosArgamassa()).isEqualTo(2);
        assertThat(resultado.pesoArgamassaKg()).isEqualByComparingTo("37.500000");
        assertThat(resultado.quantidadeEmbalagensRejunte()).isEqualTo(2);
        assertThat(resultado.pesoRejunteKg()).isEqualByComparingTo("0.960000");
        assertThat(resultado.niveladoresLadoX()).isEqualTo(2);
        assertThat(resultado.niveladoresLadoY()).isEqualTo(2);
        assertThat(resultado.quantidadeNiveladores()).isEqualTo(96);
        assertThat(resultado.quantidadePacotesNiveladores()).isEqualTo(1);
        assertThat(resultado.valorTotal()).isEqualByComparingTo("60.00");
    }

    @Test
    void replicaRecomendacoesPorFormatoDaCalculadoraCortag() {
        Piso piso100 = piso("1.00", "10.00", "100", "100", "2");
        Piso piso10 = piso("1.00", "10.00", "10", "10", "2");
        Piso piso50 = piso("1.00", "10.00", "50", "50", "2");
        when(pisoService.buscarPorCodigo("REDE-1"))
                .thenReturn(piso100, piso10, piso50);

        CalculoResponse resultado100 = calculoService.calcular(null, "REDE-1", null, 1L, null);
        CalculoResponse resultado10 = calculoService.calcular(null, "REDE-1", null, 1L, null);
        CalculoResponse resultado50 = calculoService.calcular(null, "REDE-1", null, 1L, null);

        assertThat(resultado100.niveladoresLadoX()).isEqualTo(3);
        assertThat(resultado100.niveladoresLadoY()).isEqualTo(3);
        assertThat(resultado100.quantidadeNiveladores()).isEqualTo(6);
        assertThat(resultado100.quantidadePacotesNiveladores()).isEqualTo(1);

        assertThat(resultado10.niveladoresLadoX()).isEqualTo(1);
        assertThat(resultado10.niveladoresLadoY()).isEqualTo(1);
        assertThat(resultado10.quantidadeNiveladores()).isEqualTo(200);
        assertThat(resultado10.quantidadePacotesNiveladores()).isEqualTo(2);

        assertThat(resultado50.niveladoresLadoX()).isEqualTo(2);
        assertThat(resultado50.niveladoresLadoY()).isEqualTo(2);
        assertThat(resultado50.quantidadeNiveladores()).isEqualTo(16);
        assertThat(resultado50.quantidadePacotesNiveladores()).isEqualTo(1);
    }

    private static Piso piso(String m2PorCaixa, String valor) {
        return piso(m2PorCaixa, valor, null, null, null);
    }

    private static Piso piso(
            String m2PorCaixa,
            String valor,
            String largura,
            String altura,
            String rejunte) {
        return Piso.cadastrar(new DadosPiso(
                "Piso de teste",
                "REDE-1",
                "L-001",
                decimal(largura),
                decimal(altura),
                decimal(rejunte),
                null,
                new BigDecimal(m2PorCaixa),
                null,
                null,
                null,
                AcabamentoBorda.BOLD,
                null,
                null,
                null,
                null,
                null,
                valor == null ? null : new BigDecimal(valor),
                BigDecimal.ZERO,
                false));
    }

    private void configurarParametros(
            String pesoSacoArgamassa,
            String coberturaSacoArgamassa,
            String profundidadeRejunte,
            String coeficienteRejunte,
            String pesoEmbalagemRejunte) {
        List<ParametroSistema> parametros = List.of(
                parametro("ARGAMASSA_PESO_SACO_KG", pesoSacoArgamassa),
                parametro("ARGAMASSA_COBERTURA_SACO_M2", coberturaSacoArgamassa),
                parametro("REJUNTE_PROFUNDIDADE_MM", profundidadeRejunte),
                parametro("REJUNTE_COEFICIENTE", coeficienteRejunte),
                parametro("REJUNTE_PESO_EMBALAGEM_KG", pesoEmbalagemRejunte),
                parametro("NIVELADOR_INTERVALO_CM", "40"),
                parametro("NIVELADOR_PECAS_PACOTE", "100"));
        when(parametroSistemaRepository.findAllById(any())).thenReturn(parametros);
    }

    private static ParametroSistema parametro(String chave, String valor) {
        ParametroSistema parametro = mock(ParametroSistema.class);
        when(parametro.getChave()).thenReturn(chave);
        when(parametro.getValor()).thenReturn(new BigDecimal(valor));
        return parametro;
    }

    private static BigDecimal decimal(String valor) {
        return valor == null ? null : new BigDecimal(valor);
    }
}
