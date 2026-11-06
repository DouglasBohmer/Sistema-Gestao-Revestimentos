package br.com.redeasso.gestao.configuracao.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.configuracao.domain.ParametroSistema;
import br.com.redeasso.gestao.configuracao.infrastructure.ParametroSistemaRepository;
import org.junit.jupiter.api.Test;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.util.ReflectionTestUtils;
import java.math.BigDecimal;
import java.util.List;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

class ParametrosPrecoServiceTest {
    final ParametroSistemaRepository repository = mock(ParametroSistemaRepository.class);
    final AtividadeService atividades = mock(AtividadeService.class);
    final ParametrosPrecoService service = new ParametrosPrecoService(repository,atividades);
    @Test void salvaParValidadoEAuditaValoresAnterioresENovos() throws Exception {
        var margem = parametro(ParametrosPrecoService.MARGEM,"90",2);
        var desconto = parametro(ParametrosPrecoService.DESCONTO,"12",3);
        when(repository.findAllById(any())).thenReturn(List.of(margem,desconto));
        var result = service.salvar(new BigDecimal("95.5"),BigDecimal.TEN,2,3);
        assertThat(result.margemPercentual()).isEqualByComparingTo("95.5");
        assertThat(result.descontoPercentual()).isEqualByComparingTo("10");
        assertThat(margem.getAtualizadoEm()).isNotNull(); assertThat(desconto.getAtualizadoEm()).isNotNull();
        var order = inOrder(repository,atividades);
        order.verify(repository).findAllById(List.of(ParametrosPrecoService.MARGEM,ParametrosPrecoService.DESCONTO));
        order.verify(repository).flush();
        order.verify(atividades).registrar(eq("configuracao"),contains("90% → 95.5%"),isNull());
    }
    @Test void versaoAntigaNaoSobrescreveOutroUsuario() throws Exception {
        var margem = parametro(ParametrosPrecoService.MARGEM,"90",2);
        var desconto = parametro(ParametrosPrecoService.DESCONTO,"12",3);
        when(repository.findAllById(any())).thenReturn(List.of(margem,desconto));
        assertThatThrownBy(()->service.salvar(BigDecimal.TEN,BigDecimal.ZERO,1,3)).isInstanceOf(ObjectOptimisticLockingFailureException.class);
        assertThat(margem.getValor()).isEqualByComparingTo("90"); assertThat(desconto.getValor()).isEqualByComparingTo("12");
        verify(repository,never()).flush(); verifyNoInteractions(atividades);
    }
    @Test void consultaNaoEscreveESalvarValoresIguaisNaoGeraAtividade() throws Exception {
        when(repository.findAllById(any())).thenReturn(List.of(parametro(ParametrosPrecoService.MARGEM,"90",0),parametro(ParametrosPrecoService.DESCONTO,"12",0)));
        assertThat(service.consultar().margemPercentual()).isEqualByComparingTo("90");
        service.salvar(new BigDecimal("90"),new BigDecimal("12"),0,0);
        verify(repository,never()).flush(); verifyNoInteractions(atividades);
    }
    @Test void validaPercentuaisAntesDeLerOuAlterarBanco() {
        for (String desconto : List.of("-1","100.01")) {
            assertThatThrownBy(()->service.salvar(BigDecimal.ZERO,new BigDecimal(desconto),0,0)).isInstanceOf(IllegalArgumentException.class);
        }
        assertThatThrownBy(()->service.salvar(new BigDecimal("-1"),BigDecimal.ZERO,0,0)).isInstanceOf(IllegalArgumentException.class);
        verifyNoInteractions(repository,atividades);
    }
    static ParametroSistema parametro(String chave,String valor,long versao) throws Exception {
        var constructor = ParametroSistema.class.getDeclaredConstructor(); constructor.setAccessible(true);
        var parametro = constructor.newInstance();
        ReflectionTestUtils.setField(parametro,"chave",chave); ReflectionTestUtils.setField(parametro,"valor",new BigDecimal(valor));
        ReflectionTestUtils.setField(parametro,"versao",versao); return parametro;
    }
}
