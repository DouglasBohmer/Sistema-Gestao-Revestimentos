package br.com.redeasso.gestao.mapa.application;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import br.com.redeasso.gestao.mapa.api.dto.AtualizarCelulaRequest;
import br.com.redeasso.gestao.mapa.api.dto.MapaCelulaInput;
import br.com.redeasso.gestao.mapa.domain.Mapa;
import br.com.redeasso.gestao.mapa.domain.MapaCelula;
import br.com.redeasso.gestao.mapa.infrastructure.MapaCelulaRepository;
import br.com.redeasso.gestao.mapa.infrastructure.MapaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MapaServiceTest {

    @Mock
    private MapaRepository mapaRepository;
    @Mock
    private MapaCelulaRepository celulaRepository;
    @Mock
    private PisoRepository pisoRepository;
    @Mock
    private AtividadeService atividadeService;

    private MapaService service;
    private Mapa mapa;

    @BeforeEach
    void setUp() {
        service = new MapaService(mapaRepository, celulaRepository, pisoRepository, atividadeService);
        mapa = mock(Mapa.class);
        lenient().when(mapa.getId()).thenReturn(7L);
        lenient().when(mapa.getLinhas()).thenReturn(3);
        lenient().when(mapa.getColunas()).thenReturn(4);
        lenient().when(mapa.getNome()).thenReturn("Galpão");
        lenient().when(mapa.getLabelTop()).thenReturn("");
        lenient().when(mapa.getLabelBottom()).thenReturn("");
        lenient().when(mapa.getLabelLeft()).thenReturn("");
        lenient().when(mapa.getLabelRight()).thenReturn("");
    }

    @Test
    void substituiPosicaoPreservandoAOrdemDosQuatroPisos() {
        var pisos = List.of(
                piso(1L, "1.44"),
                piso(2L, "1.50"),
                piso(3L, "2.00"),
                piso(4L, "0.75"));
        when(mapaRepository.findById(7L)).thenReturn(Optional.of(mapa));
        when(pisoRepository.findAllById(List.of(1L, 2L, 3L, 4L))).thenReturn(pisos);
        when(celulaRepository.findAllByMapaIdOrderByPosicaoAscOrdemAsc(7L)).thenReturn(List.of());

        service.atualizarCelula(7L, "b2", new AtualizarCelulaRequest(List.of(
                new MapaCelulaInput(1L, new BigDecimal("2.88"), null),
                new MapaCelulaInput(2L, null, new BigDecimal("2")),
                new MapaCelulaInput(3L, new BigDecimal("0.1"), null),
                new MapaCelulaInput(4L, null, new BigDecimal("3"))), null, null, null));

        @SuppressWarnings("unchecked")
        var captor = ArgumentCaptor.forClass(List.class);
        verify(celulaRepository).saveAllAndFlush(captor.capture());
        List<MapaCelula> salvas = captor.getValue();
        assertThat(salvas).extracting(MapaCelula::getPosicao).containsOnly("B2");
        assertThat(salvas).extracting(MapaCelula::getOrdem).containsExactly(0, 1, 2, 3);
        assertThat(salvas).extracting(item -> item.getPiso().getId()).containsExactly(1L, 2L, 3L, 4L);
        assertThat(salvas).extracting(MapaCelula::getCaixas).containsExactly(2, 2, 1, 3);
        assertThat(salvas.get(1).getM2()).isEqualByComparingTo("3.00");

        var ordem = inOrder(celulaRepository);
        ordem.verify(celulaRepository).deleteAllByMapaIdAndPosicao(7L, "B2");
        ordem.verify(celulaRepository).flush();
        ordem.verify(celulaRepository).saveAllAndFlush(salvas);
    }

    @Test
    void aceitaTemporariamenteOBodyAntigoDeUmPiso() {
        var piso = piso(3L, "1.44");
        when(mapaRepository.findById(7L)).thenReturn(Optional.of(mapa));
        when(pisoRepository.findAllById(List.of(3L))).thenReturn(List.of(piso));
        when(celulaRepository.findAllByMapaIdOrderByPosicaoAscOrdemAsc(7L)).thenReturn(List.of());

        service.atualizarCelula(7L, "A1", new AtualizarCelulaRequest(
                null, 3L, BigDecimal.ZERO, new BigDecimal("2")));

        verify(celulaRepository).saveAllAndFlush(org.mockito.ArgumentMatchers.anyList());
    }

    @Test
    void rejeitaPisoRepetidoAntesDeAlterarAPosicao() {
        when(mapaRepository.findById(7L)).thenReturn(Optional.of(mapa));
        var request = new AtualizarCelulaRequest(List.of(
                new MapaCelulaInput(1L, BigDecimal.ONE, null),
                new MapaCelulaInput(1L, BigDecimal.ONE, null)), null, null, null);

        assertThatThrownBy(() -> service.atualizarCelula(7L, "A1", request))
                .isInstanceOf(MapaException.class)
                .hasMessage("Não repita o mesmo piso na posição");

        verify(celulaRepository, never()).deleteAllByMapaIdAndPosicao(7L, "A1");
    }

    @Test
    void rejeitaPosicaoForaDasDimensoesDoMapa() {
        when(mapaRepository.findById(7L)).thenReturn(Optional.of(mapa));

        assertThatThrownBy(() -> service.limparCelula(7L, "D1"))
                .isInstanceOf(MapaException.class)
                .hasMessage("Posição inválida para este mapa");
    }

    private static Piso piso(Long id, String m2PorCaixa) {
        var piso = mock(Piso.class);
        when(piso.getId()).thenReturn(id);
        when(piso.getM2PorCaixa()).thenReturn(new BigDecimal(m2PorCaixa));
        return piso;
    }
}
