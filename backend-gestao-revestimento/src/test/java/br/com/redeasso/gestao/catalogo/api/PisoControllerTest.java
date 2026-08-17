package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.application.PisoEmUsoException;
import br.com.redeasso.gestao.catalogo.application.PisoNaoEncontradoException;
import br.com.redeasso.gestao.catalogo.application.PisoService;
import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class PisoControllerTest {

    private PisoService pisoService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        pisoService = mock(PisoService.class);
        mockMvc = MockMvcBuilders
                .standaloneSetup(new PisoController(pisoService))
                .setControllerAdvice(new CatalogoExceptionHandler())
                .build();
    }

    @Test
    void listaNoMesmoFormatoDoContratoReact() throws Exception {
        when(pisoService.listar("cimento", "Interno", "Porcelanato"))
                .thenReturn(List.of(pisoPersistido()));

        mockMvc.perform(get("/api/pisos")
                        .queryParam("search", "cimento")
                        .queryParam("localDeUso", "Interno")
                        .queryParam("tipoPiso", "Porcelanato"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(7))
                .andExpect(jsonPath("$[0].nome").value("Portinari Cimento Bold"))
                .andExpect(jsonPath("$[0].codigoRede").value("PTC-001"))
                .andExpect(jsonPath("$[0].codigoLoja").value("L-001"))
                .andExpect(jsonPath("$[0].m2PorCaixa").value(1.44))
                .andExpect(jsonPath("$[0].createdAt").value("2026-08-15T12:00:00Z"))
                .andExpect(jsonPath("$[0].updatedAt").value((Object) null));
    }

    @Test
    void criaPisoERetorna201() throws Exception {
        when(pisoService.cadastrar(any(DadosPiso.class))).thenReturn(pisoPersistido());

        mockMvc.perform(post("/api/pisos")
                        .contentType(APPLICATION_JSON)
                        .content(requisicaoValida()))
                .andExpect(status().isCreated())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_JSON))
                .andExpect(jsonPath("$.id").value(7))
                .andExpect(jsonPath("$.nome").value("Portinari Cimento Bold"));
    }

    @Test
    void rejeitaCadastroInvalidoNoFormatoErrorResponse() throws Exception {
        mockMvc.perform(post("/api/pisos")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"nome":"", "codigoLoja":"", "m2PorCaixa":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("Dados de entrada inválidos"))
                .andExpect(jsonPath("$.status").doesNotExist());
    }

    @Test
    void retorna404NoFormatoLegado() throws Exception {
        when(pisoService.buscarPorId(999)).thenThrow(new PisoNaoEncontradoException());

        mockMvc.perform(get("/api/pisos/999"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("Piso não encontrado"));
    }

    @Test
    void excluiCom204SemCorpo() throws Exception {
        mockMvc.perform(delete("/api/pisos/7"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(pisoService).excluir(7);
    }

    @Test
    void impedeExcluirPisoVinculadoAoMapaCom409() throws Exception {
        doThrow(new PisoEmUsoException(new RuntimeException("mapa_celulas_piso_id_fkey")))
                .when(pisoService).excluir(7);

        mockMvc.perform(delete("/api/pisos/7"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error")
                        .value("Piso não pode ser excluído porque está vinculado a um mapa"))
                .andExpect(content().string(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("mapa_celulas_piso_id_fkey"))));
    }

    private static Piso pisoPersistido() {
        Piso piso = Piso.cadastrar(new DadosPiso(
                "Portinari Cimento Bold",
                "PTC-001",
                "L-001",
                new BigDecimal("60"),
                new BigDecimal("60"),
                new BigDecimal("2"),
                new BigDecimal("4"),
                new BigDecimal("1.44"),
                "Interno",
                "Porcelanato",
                4,
                true,
                null,
                null,
                new BigDecimal("89.90")));
        ReflectionTestUtils.setField(piso, "id", 7L);
        ReflectionTestUtils.setField(piso, "createdAt", Instant.parse("2026-08-15T12:00:00Z"));
        return piso;
    }

    private static String requisicaoValida() {
        return """
                {
                  "nome": "Portinari Cimento Bold",
                  "codigoRede": "PTC-001",
                  "codigoLoja": "L-001",
                  "largura": 60,
                  "altura": 60,
                  "rejunte": 2,
                  "pecasPorCaixa": 4,
                  "m2PorCaixa": 1.44,
                  "localDeUso": "Interno",
                  "tipoPiso": "Porcelanato",
                  "pei": 4,
                  "retificado": true,
                  "valor": 89.90
                }
                """;
    }
}
