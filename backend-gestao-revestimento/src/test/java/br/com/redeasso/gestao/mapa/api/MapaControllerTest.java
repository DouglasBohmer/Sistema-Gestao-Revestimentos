package br.com.redeasso.gestao.mapa.api;

import br.com.redeasso.gestao.mapa.api.dto.MapaLabelsResponse;
import br.com.redeasso.gestao.mapa.api.dto.MapaResponse;
import br.com.redeasso.gestao.mapa.application.MapaException;
import br.com.redeasso.gestao.mapa.application.MapaService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MapaControllerTest {

    private MapaService service;
    private MockMvc mockMvc;
    private MapaResponse resposta;

    @BeforeEach
    void setUp() {
        service = mock(MapaService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new MapaController(service))
                .setControllerAdvice(new MapaExceptionHandler())
                .build();
        resposta = new MapaResponse(
                1L, "Galpão", 3, 4,
                new MapaLabelsResponse("Norte", "Sul", "Oeste", "Leste"),
                new LinkedHashMap<>(), Instant.parse("2026-08-15T10:00:00Z"),
                Instant.parse("2026-08-15T10:00:00Z"));
    }

    @Test
    void criaMapaComContratoConsumidoPeloReact() throws Exception {
        when(service.criar(org.mockito.ArgumentMatchers.any())).thenReturn(resposta);

        mockMvc.perform(post("/api/mapas")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"nome":"Galpão","linhas":3,"colunas":4,
                                 "labels":{"top":"Norte","bottom":"Sul","left":"Oeste","right":"Leste"}}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.nome").value("Galpão"))
                .andExpect(jsonPath("$.labels.top").value("Norte"))
                .andExpect(jsonPath("$.celulas").isMap())
                .andExpect(jsonPath("$.createdAt").value("2026-08-15T10:00:00Z"));
    }

    @Test
    void desserializaBodyNovoComPisosEmOrdem() throws Exception {
        when(service.atualizarCelula(org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq("A1"), org.mockito.ArgumentMatchers.any())).thenReturn(resposta);

        mockMvc.perform(put("/api/mapas/1/celulas/A1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"pisos":[
                                  {"pisoId":8,"m2":2.5,"caixas":0},
                                  {"pisoId":3,"m2":0,"caixas":2}
                                ]}
                                """))
                .andExpect(status().isOk());

        var captor = ArgumentCaptor.forClass(br.com.redeasso.gestao.mapa.api.dto.AtualizarCelulaRequest.class);
        verify(service).atualizarCelula(org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq("A1"), captor.capture());
        assertThat(captor.getValue().itens()).extracting(item -> item.pisoId()).containsExactly(8L, 3L);
    }

    @Test
    void desserializaBodyAntigoDePisoUnico() throws Exception {
        when(service.atualizarCelula(org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq("A1"), org.mockito.ArgumentMatchers.any())).thenReturn(resposta);

        mockMvc.perform(put("/api/mapas/1/celulas/A1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pisoId\":8,\"m2\":2.5,\"caixas\":0}"))
                .andExpect(status().isOk());

        var captor = ArgumentCaptor.forClass(br.com.redeasso.gestao.mapa.api.dto.AtualizarCelulaRequest.class);
        verify(service).atualizarCelula(org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq("A1"), captor.capture());
        assertThat(captor.getValue().itens()).extracting(item -> item.pisoId()).containsExactly(8L);
    }

    @Test
    void retornaErroComMessageCompativel() throws Exception {
        when(service.buscar(99L)).thenThrow(MapaException.naoEncontrado());

        mockMvc.perform(get("/api/mapas/99"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Mapa não encontrado"));
    }

    @Test
    void excluiMapaComStatus204() throws Exception {
        mockMvc.perform(delete("/api/mapas/1"))
                .andExpect(status().isNoContent());

        verify(service).excluir(1L);
    }
}
