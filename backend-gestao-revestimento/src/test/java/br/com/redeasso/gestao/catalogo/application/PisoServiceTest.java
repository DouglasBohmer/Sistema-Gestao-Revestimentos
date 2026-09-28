package br.com.redeasso.gestao.catalogo.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import br.com.redeasso.gestao.catalogo.domain.ClassificacaoUso;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PisoServiceTest {

    @Mock
    private PisoRepository pisoRepository;

    @Mock
    private AtividadeService atividadeService;

    private PisoService pisoService;

    @BeforeEach
    void setUp() {
        pisoService = new PisoService(pisoRepository, atividadeService);
    }

    @Test
    void cadastraPisoERegistraAtividadeNaMesmaOperacao() {
        when(pisoRepository.save(any(Piso.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Piso cadastrado = pisoService.cadastrar(dados("Novo Porcelanato", "LOJA-10"));

        assertThat(cadastrado.getNome()).isEqualTo("Novo Porcelanato");
        assertThat(cadastrado.getM2PorCaixa()).isEqualByComparingTo("1.44");
        verify(atividadeService).registrar(
                "cadastro",
                "Piso Novo Porcelanato cadastrado",
                "Novo Porcelanato");
    }

    @Test
    void buscaPeloCodigoDaLojaOuDaRede() {
        Piso piso = Piso.cadastrar(dados("Piso", "LOJA-10"));
        when(pisoRepository.findAllByCodigoLojaOrCodigoRedeOrderByIdAsc("REDE-10", "REDE-10"))
                .thenReturn(List.of(piso));

        assertThat(pisoService.buscarPorCodigo(" REDE-10 ")).isSameAs(piso);
    }

    @Test
    void informaQuandoCodigoNaoExiste() {
        when(pisoRepository.findAllByCodigoLojaOrCodigoRedeOrderByIdAsc("INEXISTENTE", "INEXISTENTE"))
                .thenReturn(List.of());

        assertThatThrownBy(() -> pisoService.buscarPorCodigo("INEXISTENTE"))
                .isInstanceOf(PisoNaoEncontradoException.class)
                .hasMessage("Piso não encontrado");
    }

    @Test
    void exigeEscolhaQuandoUmCodigoIdentificaMaisDeUmProduto() {
        Piso primeiro = Piso.cadastrar(dados("Primeiro", "LOJA-10"));
        Piso segundo = Piso.cadastrar(dados("Segundo", "LOJA-10"));
        when(pisoRepository.findAllByCodigoLojaOrCodigoRedeOrderByIdAsc("LOJA-10", "LOJA-10"))
                .thenReturn(List.of(primeiro, segundo));

        assertThatThrownBy(() -> pisoService.buscarPorCodigo("LOJA-10"))
                .isInstanceOf(CodigoPisoAmbiguoException.class)
                .hasMessage("Mais de um produto foi encontrado para o código informado");
    }

    @Test
    void impedeNomeRepetidoIgnorandoCaixaEEspacos() {
        when(pisoRepository.contarPorNomeNormalizado("piso existente", null)).thenReturn(1L);

        assertThatThrownBy(() -> pisoService.cadastrar(dados(" piso existente ", "LOJA-20")))
                .isInstanceOf(PisoNomeDuplicadoException.class)
                .hasMessage("Já existe um produto com esse nome");
        verifyNoInteractions(atividadeService);
    }

    @Test
    void excluiPisoSemApagarOHistoricoDaAtividade() {
        Piso piso = Piso.cadastrar(dados("Piso removido", "LOJA-10"));
        when(pisoRepository.findById(10L)).thenReturn(Optional.of(piso));

        pisoService.excluir(10L);

        verify(pisoRepository).delete(piso);
        verify(pisoRepository).flush();
        verify(atividadeService).registrar(
                "cadastro",
                "Piso Piso removido excluído",
                "Piso removido");
    }

    @Test
    void impedeExcluirPisoQueEstaVinculadoAUmMapa() {
        Piso piso = Piso.cadastrar(dados("Piso em uso", "LOJA-10"));
        when(pisoRepository.findById(10L)).thenReturn(Optional.of(piso));
        doThrow(new DataIntegrityViolationException("mapa_celulas_piso_id_fkey"))
                .when(pisoRepository).flush();

        assertThatThrownBy(() -> pisoService.excluir(10L))
                .isInstanceOf(PisoEmUsoException.class)
                .hasMessage("Piso não pode ser excluído porque está vinculado a um mapa");
        verifyNoInteractions(atividadeService);
    }

    private static DadosPiso dados(String nome, String codigoLoja) {
        return new DadosPiso(
                nome,
                "REDE-10",
                codigoLoja,
                new BigDecimal("60"),
                new BigDecimal("60"),
                new BigDecimal("2"),
                new BigDecimal("4"),
                new BigDecimal("1.44"),
                "Interno",
                "Porcelanato",
                ClassificacaoUso.LD,
                AcabamentoBorda.RETIFICADO,
                null,
                null,
                null,
                new BigDecimal("89.90"),
                BigDecimal.ZERO,
                false);
    }
}
