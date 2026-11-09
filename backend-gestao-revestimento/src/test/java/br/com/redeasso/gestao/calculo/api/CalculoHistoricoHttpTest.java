package br.com.redeasso.gestao.calculo.api;

import br.com.redeasso.gestao.calculo.application.CalculoHistoricoService;
import br.com.redeasso.gestao.catalogo.api.PisosRecentesController;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import br.com.redeasso.gestao.shared.api.*;
import br.com.redeasso.gestao.shared.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest({CalculoHistoricoController.class, PisosRecentesController.class})
@Import({SecurityConfiguration.class, ApiExceptionHandler.class, ApiErrorResponseWriter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class CalculoHistoricoHttpTest {
    @Autowired MockMvc mvc;
    @MockitoBean CalculoHistoricoService service;
    @MockitoBean PisoRepository pisos;
    @Test void exigeSessaoEmTodasAsLeituras() throws Exception {
        for (String url : new String[]{"/api/calculos/historico", "/api/calculos/historico/1", "/api/pisos/recentes"}) mvc.perform(get(url)).andExpect(status().isUnauthorized());
        verifyNoInteractions(service, pisos);
    }
    @Test void consultaHistoricoGlobalSemFiltrarPorUsuarioERetorna404ParaIdAusente() throws Exception {
        when(service.recentes()).thenReturn(java.util.List.of());
        when(pisos.findTop15ByOrderByCreatedAtDescIdDesc()).thenReturn(java.util.List.of());
        mvc.perform(get("/api/calculos/historico").with(user("outro-pc"))).andExpect(status().isOk()).andExpect(content().json("[]"));
        mvc.perform(get("/api/pisos/recentes").with(user("outro-pc"))).andExpect(status().isOk()).andExpect(content().json("[]"));
        when(service.reabrir(999)).thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Cálculo não encontrado"));
        mvc.perform(get("/api/calculos/historico/999").with(user("outro-pc"))).andExpect(status().isNotFound());
        verify(service).recentes();
        verify(service).reabrir(999);
    }
}
