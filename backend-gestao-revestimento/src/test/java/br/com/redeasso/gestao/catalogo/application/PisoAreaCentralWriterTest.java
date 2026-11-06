package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import br.com.redeasso.gestao.catalogo.domain.OrigemDadoProduto;
import br.com.redeasso.gestao.configuracao.infrastructure.ParametroSistemaRepository;
import br.com.redeasso.gestao.configuracao.domain.ParametroSistema;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PisoAreaCentralWriterTest {
    final PisoRepository pisos = mock(PisoRepository.class);
    final ParametroSistemaRepository parametros = mock(ParametroSistemaRepository.class);
    final PisoAreaCentralWriter writer = new PisoAreaCentralWriter(pisos,parametros);
    @Test void transformaBrutoEmVendaComParametrosPersistidosPreservandoDadosTecnicos() {
        var piso = PisoAreaCentralServiceTest.piso("1234567");
        when(pisos.findById(1L)).thenReturn(Optional.of(piso));
        parameter("PRECO_LUCRO_PERCENTUAL","90"); parameter("PRECO_DESCONTO_PERCENTUAL","12");
        writer.atualizar(1L,"1234567",new AreaCentralProductClient.Product(true,BigDecimal.TEN,BigDecimal.ZERO,"ACABAR"));
        assertThat(piso.getValor()).isEqualByComparingTo("16.72");
        assertThat(piso.getEstoqueM2()).isZero();
        assertThat(piso.isAtivo()).isTrue();
        assertThat(piso.getOrigemValor()).isEqualTo(OrigemDadoProduto.AREA_CENTRAL);
        assertThat(piso.getM2PorCaixa()).isEqualByComparingTo("1.44");
        assertThat(piso.getNome()).isEqualTo("Piso fictício");
        assertThat(piso.getUltimaConsultaAreaCentralEm()).isNotNull();
    }
    @Test void ausenciaConfirmadaDesativaPreservandoPrecoEEstoqueAnteriores() {
        var piso = PisoAreaCentralServiceTest.piso("1234567");
        when(pisos.findById(1L)).thenReturn(Optional.of(piso));
        writer.atualizar(1L,"1234567",AreaCentralProductClient.Product.naoEncontrado());
        assertThat(piso.isAtivo()).isFalse();
        assertThat(piso.getValor()).isEqualByComparingTo("20");
        assertThat(piso.getEstoqueM2()).isEqualByComparingTo("30");
        verifyNoInteractions(parametros);
    }
    @Test void codigoAlteradoDuranteConsultaNaoRecebeDadosDeOutroProduto() {
        when(pisos.findById(1L)).thenReturn(Optional.of(PisoAreaCentralServiceTest.piso("outro")));
        assertThatThrownBy(()->writer.atualizar(1L,"1234567",AreaCentralProductClient.Product.naoEncontrado()))
                .isInstanceOf(AreaCentralProductException.class);
        verify(pisos,never()).save(any());
    }
    void parameter(String key,String value) {
        ParametroSistema parameter = mock(ParametroSistema.class);
        when(parameter.getValor()).thenReturn(new BigDecimal(value));
        when(parametros.findById(key)).thenReturn(Optional.of(parameter));
    }
}
