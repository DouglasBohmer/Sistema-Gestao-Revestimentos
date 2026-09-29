package br.com.redeasso.gestao.catalogo.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PisoTest {

    @Test
    void exigeAoMenosUmCodigo() {
        assertThatThrownBy(() -> Piso.cadastrar(dados(null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("Ao menos um código ASSO ou CTC é obrigatório");
    }

    @Test
    void produtoNaoEncontradoDesativaSemApagarUltimosDados() {
        Piso piso = Piso.cadastrar(dados("ASSO-1", null));
        Instant primeiraConsulta = Instant.parse("2026-09-28T12:00:00Z");
        piso.atualizarPelaAreaCentral(
                true,
                new BigDecimal("89.90"),
                new BigDecimal("18.50"),
                "FORA_DE_LINHA",
                primeiraConsulta);

        assertThat(piso.isAtivo()).isTrue();
        assertThat(piso.getOrigemValor()).isEqualTo(OrigemDadoProduto.AREA_CENTRAL);

        Instant segundaConsulta = Instant.parse("2026-09-29T12:00:00Z");
        piso.atualizarPelaAreaCentral(false, null, null, "PRODUTO_NAO_ENCONTRADO", segundaConsulta);

        assertThat(piso.isAtivo()).isFalse();
        assertThat(piso.getValor()).isEqualByComparingTo("89.90");
        assertThat(piso.getEstoqueM2()).isEqualByComparingTo("18.50");
        assertThat(piso.getUltimaConsultaAreaCentralEm()).isEqualTo(segundaConsulta);
    }

    @Test
    void calculaPecasPorCaixaComArredondamentoComum() {
        Piso piso = Piso.cadastrar(dados("ASSO-1", null, "1.62"));

        assertThat(piso.getPecasPorCaixa()).isEqualByComparingTo("5");
    }

    private static DadosPiso dados(String codigoRede, String codigoLoja) {
        return dados(codigoRede, codigoLoja, "1.44");
    }

    private static DadosPiso dados(String codigoRede, String codigoLoja, String m2PorCaixa) {
        return new DadosPiso(
                "Piso de teste",
                codigoRede,
                codigoLoja,
                new BigDecimal("60"),
                new BigDecimal("60"),
                new BigDecimal("2"),
                new BigDecimal("4"),
                new BigDecimal(m2PorCaixa),
                null,
                null,
                ClassificacaoUso.LD,
                AcabamentoBorda.RETIFICADO,
                null,
                null,
                null,
                null,
                null,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                false);
    }
}
