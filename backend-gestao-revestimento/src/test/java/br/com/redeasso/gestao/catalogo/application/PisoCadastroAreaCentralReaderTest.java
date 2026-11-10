package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import br.com.redeasso.gestao.configuracao.application.ParametrosPrecoService;
import br.com.redeasso.gestao.integracao.areacentral.application.AreaCentralProductClient.Product;
import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class PisoCadastroAreaCentralReaderTest {
    final PisoRepository pisos=mock(PisoRepository.class);
    final ParametrosPrecoService precos=mock(ParametrosPrecoService.class);
    final PisoCadastroAreaCentralReader reader=new PisoCadastroAreaCentralReader(pisos,precos);
    PisoCadastroAreaCentralReaderTest(){
        when(pisos.findAllByCodigoRedeOrderByIdAsc("123")).thenReturn(List.of());
        when(precos.consultar()).thenReturn(new ParametrosPrecoService.Valores(new BigDecimal("90"),new BigDecimal("12"),0,0));
    }
    Product produto(String nome){return new Product(true,BigDecimal.TEN,BigDecimal.ZERO,"PADRAO",nome,new BigDecimal("2.28"),null);}
    @Test void preparaRascunhoSemGravarCalculaPrecoComParametrosEExtraiSomenteFormatoExplicito(){
        var result=reader.preparar("123",produto("PISO FICTÍCIO 62X122 RETIF"));
        assertThat(result.valorVendaM2()).isEqualByComparingTo("16.75");
        assertThat(result.largura()).isEqualByComparingTo("62");assertThat(result.altura()).isEqualByComparingTo("122");
        assertThat(result.acabamentoBordas()).isEqualTo(AcabamentoBorda.RETIFICADO);
        verify(pisos).findAllByCodigoRedeOrderByIdAsc("123");verifyNoMoreInteractions(pisos);
    }
    @Test void naoInventaFormatoBordasOuPrecoQuandoProdutoNaoFoiEncontrado(){
        for(String nome:List.of("PISO SEM FORMATO","PISO 60X60 OU 90X90","PISO 1000X1000")){
            var result=reader.preparar("123",produto(nome));assertThat(result.largura()).isNull();assertThat(result.altura()).isNull();assertThat(result.acabamentoBordas()).isNull();
        }
        clearInvocations(precos);
        assertThat(reader.preparar("123",Product.naoEncontrado()).encontrado()).isFalse();verifyNoInteractions(precos);
    }
    @Test void devolveTodosOsCadastrosDeUmAssoSemEscolherOPrimeiro(){
        when(pisos.findAllByCodigoRedeOrderByIdAsc("123")).thenReturn(List.of(PisoAreaCentralServiceTest.piso("123"),PisoAreaCentralServiceTest.piso("123")));
        assertThat(reader.preparar("123",produto("PISO FICTÍCIO")).cadastros()).hasSize(2);
    }
}
