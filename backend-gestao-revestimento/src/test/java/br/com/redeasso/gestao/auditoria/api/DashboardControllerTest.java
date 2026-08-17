package br.com.redeasso.gestao.auditoria.api;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.auditoria.domain.Atividade;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DashboardControllerTest {

    private PisoRepository pisoRepository;
    private AtividadeService atividadeService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        pisoRepository = mock(PisoRepository.class);
        atividadeService = mock(AtividadeService.class);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new DashboardController(pisoRepository, atividadeService))
                .build();
    }

    @Test
    void calculaEstatisticasComDadosPersistidos() throws Exception {
        when(pisoRepository.count()).thenReturn(12L);
        when(atividadeService.contarPorTipo("calculo")).thenReturn(8L);
        when(atividadeService.contarPorTipo("impressao")).thenReturn(3L);

        mockMvc.perform(get("/api/dashboard/stats"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalPisos").value(12))
                .andExpect(jsonPath("$.calculosRealizados").value(8))
                .andExpect(jsonPath("$.totalImpressoes").value(3))
                .andExpect(jsonPath("$.estoqueDisponivel").value(12));
    }

    @Test
    void retornaAtividadesRecentesNoContratoAtual() throws Exception {
        Atividade atividade = new Atividade("cadastro", "Piso cadastrado", "Piso A");
        ReflectionTestUtils.setField(atividade, "id", 5L);
        ReflectionTestUtils.setField(atividade, "createdAt", Instant.parse("2026-08-15T12:30:00Z"));
        when(atividadeService.listarRecentes()).thenReturn(List.of(atividade));

        mockMvc.perform(get("/api/dashboard/atividade-recente"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(5))
                .andExpect(jsonPath("$[0].tipo").value("cadastro"))
                .andExpect(jsonPath("$[0].descricao").value("Piso cadastrado"))
                .andExpect(jsonPath("$[0].pisoNome").value("Piso A"))
                .andExpect(jsonPath("$[0].createdAt").value("2026-08-15T12:30:00Z"));
    }

    @Test
    void agrupaPisosPorTipo() throws Exception {
        PisoRepository.PisosPorTipo grupo = mock(PisoRepository.PisosPorTipo.class);
        when(grupo.getTipo()).thenReturn("Porcelanato");
        when(grupo.getTotal()).thenReturn(4L);
        when(pisoRepository.contarPorTipo()).thenReturn(List.of(grupo));

        mockMvc.perform(get("/api/dashboard/pisos-por-tipo"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].tipo").value("Porcelanato"))
                .andExpect(jsonPath("$[0].total").value(4));
    }
}
