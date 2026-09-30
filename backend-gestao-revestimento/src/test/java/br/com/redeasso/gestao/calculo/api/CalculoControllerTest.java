package br.com.redeasso.gestao.calculo.api;

import br.com.redeasso.gestao.calculo.application.CalculoService;
import br.com.redeasso.gestao.catalogo.api.PisoResponse;
import br.com.redeasso.gestao.catalogo.application.PisoNaoEncontradoException;
import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import br.com.redeasso.gestao.catalogo.domain.ClassificacaoUso;
import br.com.redeasso.gestao.catalogo.domain.OrigemDadoProduto;
import br.com.redeasso.gestao.shared.api.ApiExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.math.BigDecimal;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CalculoControllerTest {

    private CalculoService calculoService;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        calculoService = mock(CalculoService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new CalculoController(calculoService))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void mantemOContratoConsumidoPeloReact() throws Exception {
        when(calculoService.calcular(any(), any(), any(), any(), any())).thenReturn(resposta());

        mockMvc.perform(post("/api/pisos/calcular")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"codigoPiso":"L-001","metragemM2":45.5,"margemQuebra":10}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.piso.codigoLoja").value("L-001"))
                .andExpect(jsonPath("$.metragemComMargem").value(50.05))
                .andExpect(jsonPath("$.quantidadeCaixas").value(35))
                .andExpect(jsonPath("$.quantidadeNiveladores").isEmpty())
                .andExpect(jsonPath("$.valorTotal").value(4530.96));

        verify(calculoService).calcular(
                null,
                "L-001",
                new BigDecimal("45.5"),
                null,
                new BigDecimal("10"));
    }

    @Test
    void aceitaQuantidadeExataDeCaixas() throws Exception {
        when(calculoService.calcular(any(), any(), any(), any(), any())).thenReturn(resposta());

        mockMvc.perform(post("/api/pisos/calcular")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"codigoPiso":"L-001","quantidadeCaixas":4}
                                """))
                .andExpect(status().isOk());

        verify(calculoService).calcular(null, "L-001", null, 4L, null);
    }

    @Test
    void rejeitaMetragemNaoPositiva() throws Exception {
        mockMvc.perform(post("/api/pisos/calcular")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"codigoPiso":"L-001","metragemM2":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("Dados de entrada inválidos"));
    }

    @Test
    void rejeitaQuantidadeDeCaixasNaoPositiva() throws Exception {
        mockMvc.perform(post("/api/pisos/calcular")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"codigoPiso":"L-001","quantidadeCaixas":0}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void rejeitaMetragemECaixasInformadasAoMesmoTempo() throws Exception {
        mockMvc.perform(post("/api/pisos/calcular")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"codigoPiso":"L-001","metragemM2":10,"quantidadeCaixas":4}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void rejeitaPedidoSemMetragemNemCaixas() throws Exception {
        mockMvc.perform(post("/api/pisos/calcular")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"codigoPiso":"L-001"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void responde404QuandoOcodigoNaoExiste() throws Exception {
        when(calculoService.calcular(any(), any(), any(), any(), any()))
                .thenThrow(new PisoNaoEncontradoException());

        mockMvc.perform(post("/api/pisos/calcular")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"codigoPiso":"INEXISTENTE","metragemM2":10}
                                """))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("PISO_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Piso não encontrado"));
    }

    private static CalculoResponse resposta() {
        PisoResponse piso = new PisoResponse(
                1L,
                "Portinari Cimento Bold",
                "PTC-001",
                "L-001",
                null,
                null,
                null,
                null,
                new BigDecimal("1.44"),
                "Interno",
                "Porcelanato",
                ClassificacaoUso.LD,
                AcabamentoBorda.RETIFICADO,
                null,
                null,
                null,
                null,
                null,
                new BigDecimal("89.90"),
                BigDecimal.ZERO,
                null,
                null,
                true,
                OrigemDadoProduto.MANUAL,
                OrigemDadoProduto.NAO_INFORMADO,
                Instant.parse("2026-08-15T12:00:00Z"),
                null);
        return new CalculoResponse(
                piso,
                new BigDecimal("45.5"),
                new BigDecimal("10"),
                new BigDecimal("50.050000"),
                35,
                new BigDecimal("50.400000"),
                17,
                new BigDecimal("336.000000"),
                null,
                null,
                null,
                null,
                null,
                null,
                new BigDecimal("4530.96"));
    }
}
