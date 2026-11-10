package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import br.com.redeasso.gestao.catalogo.domain.*;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.*;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class PisoAreaCentralServiceTest {
    final PisoService pisos = mock(PisoService.class);
    final PisoAreaCentralWriter writer = mock(PisoAreaCentralWriter.class);
    final AreaCentralProductClient client = mock(AreaCentralProductClient.class);
    final AreaCentralSessionStore sessions = mock(AreaCentralSessionStore.class);
    final AreaCentralProperties properties = mock(AreaCentralProperties.class);
    final PisoCadastroAreaCentralReader cadastroReader = mock(PisoCadastroAreaCentralReader.class);
    final PisoAreaCentralService service = new PisoAreaCentralService(pisos, writer, client, sessions, properties, cadastroReader);
    final AreaCentralCookieJar jar = new AreaCentralCookieJar(List.of());
    @Test void consultaCadastroNaoUsaOutraSessaoNemGravaProdutosERevogaSessaoExpirada(){
        var product=new AreaCentralProductClient.Product(true,BigDecimal.TEN,BigDecimal.ZERO,"PADRAO","Piso fictício",BigDecimal.ONE,null);
        when(client.consultar("123",jar)).thenReturn(product);
        service.consultarCadastro("123","sessao-ficticia");
        verify(cadastroReader).preparar("123",product);verifyNoInteractions(pisos,writer);
        assertThatThrownBy(()->service.consultarCadastro("123","outra-sessao")).isInstanceOf(AreaCentralProductException.class);
        when(client.consultar("123",jar)).thenThrow(new AreaCentralProductException(AreaCentralProductException.Code.SESSION_EXPIRED));
        assertThatThrownBy(()->service.consultarCadastro("123","sessao-ficticia")).isInstanceOf(AreaCentralProductException.class);
        verify(sessions).remove("sessao-ficticia");
    }
    PisoAreaCentralServiceTest() {
        when(properties.enabled()).thenReturn(true);
        when(sessions.find("sessao-ficticia")).thenReturn(Optional.of(jar));
    }
    @Test void consultaUsaSomenteSessaoDoUsuarioEAtualizaUmaVezPorId() {
        var piso = piso("1234567");
        when(pisos.buscarPorId(1L)).thenReturn(piso);
        var product = new AreaCentralProductClient.Product(true, BigDecimal.TEN, BigDecimal.ONE, "PADRAO");
        when(client.consultar("1234567", jar)).thenReturn(product);
        when(writer.atualizar(1L, "1234567", product)).thenReturn(piso);
        var results = service.atualizar(List.of(1L,1L), "sessao-ficticia");
        assertThat(results).singleElement().satisfies(result -> assertThat(result.status()).isEqualTo("UPDATED"));
        verify(client, times(1)).consultar("1234567", jar);
        assertThatThrownBy(() -> service.atualizar(List.of(1L), "outra-sessao")).isInstanceOf(AreaCentralProductException.class);
        verifyNoMoreInteractions(client);
    }
    @Test void produtoApenasCtcNaoFazConsultaNemSobrescreveValorManual() {
        when(pisos.buscarPorId(1L)).thenReturn(piso(null));
        assertThat(service.atualizar(List.of(1L), "sessao-ficticia").getFirst().status()).isEqualTo("MANUAL");
        verifyNoInteractions(client, writer);
    }
    @Test void falhaDePortalPreservaBancoSemChamarWriter() {
        when(pisos.buscarPorId(1L)).thenReturn(piso("1234567"));
        when(client.consultar(anyString(), same(jar))).thenThrow(new AreaCentralProductException(AreaCentralProductException.Code.UPSTREAM_UNAVAILABLE));
        assertThat(service.atualizar(List.of(1L), "sessao-ficticia").getFirst().code()).isEqualTo("UPSTREAM_UNAVAILABLE");
        verifyNoInteractions(writer);
    }
    @Test void sessaoExternaExpiradaRevogaJarEInterrompeRestanteDoLote() {
        when(pisos.buscarPorId(1L)).thenReturn(piso("1234567"));
        when(client.consultar(anyString(), same(jar))).thenThrow(new AreaCentralProductException(AreaCentralProductException.Code.SESSION_EXPIRED));
        assertThat(service.atualizar(List.of(1L,2L), "sessao-ficticia")).allSatisfy(result -> assertThat(result.code()).isEqualTo("SESSION_EXPIRED"));
        verify(sessions).remove("sessao-ficticia"); verifyNoInteractions(writer);
        verify(pisos, never()).buscarPorId(2L);
    }
    @Test void soNaoEncontradoConfirmadoEnviaDesativacaoAoWriter() {
        var piso = piso("1234567"); var absent = AreaCentralProductClient.Product.naoEncontrado();
        when(pisos.buscarPorId(1L)).thenReturn(piso);
        when(client.consultar("1234567",jar)).thenReturn(absent);
        when(writer.atualizar(1L,"1234567",absent)).thenReturn(piso);
        assertThat(service.atualizar(List.of(1L), "sessao-ficticia").getFirst().status()).isEqualTo("NOT_FOUND");
        verify(writer).atualizar(1L,"1234567",absent);
    }
    @Test void atualizaAntesDoCalculoSemUsarSessaoDeOutraConta() {
        when(sessions.hasSession("sessao-ficticia")).thenReturn(true);
        var piso = piso("1234567");
        org.springframework.test.util.ReflectionTestUtils.setField(piso, "id", 1L);
        when(pisos.buscarPorId(1L)).thenReturn(piso);
        var product = new AreaCentralProductClient.Product(true, BigDecimal.TEN, BigDecimal.ONE, "PADRAO");
        when(client.consultar("1234567", jar)).thenReturn(product);
        when(writer.atualizar(1L, "1234567", product)).thenReturn(piso);
        service.atualizarParaCalculo(1L, null, "sessao-ficticia");
        verify(client).consultar("1234567", jar);
        verify(writer).atualizar(1L, "1234567", product);
        service.atualizarParaCalculo(1L, null, "outra-sessao");
        verifyNoMoreInteractions(client, writer);
    }
    @Test void falhaDeAtualizacaoImpedeCalculoComValorDesatualizado() {
        when(sessions.hasSession("sessao-ficticia")).thenReturn(true);
        var piso = piso("1234567");
        org.springframework.test.util.ReflectionTestUtils.setField(piso, "id", 1L);
        when(pisos.buscarPorId(1L)).thenReturn(piso);
        when(client.consultar("1234567", jar)).thenThrow(new AreaCentralProductException(AreaCentralProductException.Code.UPSTREAM_UNAVAILABLE));
        assertThatThrownBy(() -> service.atualizarParaCalculo(1L, null, "sessao-ficticia"))
                .isInstanceOf(AreaCentralProductException.class);
        verifyNoInteractions(writer);
    }
    static Piso piso(String codigo) {
        return Piso.cadastrar(new DadosPiso("Piso fictício", codigo, "CTC-1", new BigDecimal("60"),new BigDecimal("60"),
                BigDecimal.valueOf(2), BigDecimal.valueOf(4),new BigDecimal("1.44"),null,null,ClassificacaoUso.LD,
                AcabamentoBorda.RETIFICADO,null,null,null,null,null,new BigDecimal("20"),new BigDecimal("30"),true));
    }
}
