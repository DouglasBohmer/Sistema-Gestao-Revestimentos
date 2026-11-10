package br.com.redeasso.gestao.catalogo.api;

import br.com.redeasso.gestao.catalogo.application.PisoAreaCentralService;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import br.com.redeasso.gestao.shared.api.*;
import br.com.redeasso.gestao.shared.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.List;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PisoAreaCentralController.class)
@Import({SecurityConfiguration.class, ApiExceptionHandler.class, ApiErrorResponseWriter.class,
        JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class PisoAreaCentralHttpTest {
    @Autowired MockMvc mvc;
    @MockitoBean PisoAreaCentralService service;
    static final String URL = "/api/pisos/area-central/atualizar";
    @Test void consultaCadastroExigeSessaoCsrfECodigoSeguroSemSalvarNada() throws Exception {
        String url="/api/pisos/area-central/consultar-cadastro";
        mvc.perform(post(url).with(csrf()).contentType("application/json").content("{\"codigoRede\":\"123\"}")).andExpect(status().isUnauthorized());
        mvc.perform(post(url).with(user("teste")).contentType("application/json").content("{\"codigoRede\":\"123\"}")).andExpect(status().isForbidden());
        for(String codigo:List.of("", "a b", "https://outro.example?x=y", "a".repeat(101))){
            mvc.perform(post(url).with(user("teste")).with(csrf()).contentType("application/json").content("{\"codigoRede\":\""+codigo+"\"}")).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
        mvc.perform(post(url).with(user("teste")).with(csrf()).contentType("application/json").content("{\"codigoRede\":\"123\"}")).andExpect(status().isOk());
        verify(service).consultarCadastro(eq("123"),anyString());
    }
    @Test void exigeAutenticacaoECsrfMesmoComCookieExternoValidoEmOutroLugar() throws Exception {
        mvc.perform(post(URL).with(csrf()).contentType("application/json").content("{\"ids\":[1]}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post(URL).with(user("teste")).contentType("application/json").content("{\"ids\":[1]}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void aceitaLotePequenoERecusaLoteVazioGiganteOuIdInvalido() throws Exception {
        when(service.atualizar(anyList(),anyString())).thenReturn(List.of(new PisoAreaCentralService.Result(1L,"FAILED",null,"UPSTREAM_UNAVAILABLE")));
        mvc.perform(post(URL).with(user("teste")).with(csrf()).contentType("application/json").content("{\"ids\":[1]}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].code").value("UPSTREAM_UNAVAILABLE"));
        for (String ids : List.of("[]","[1,2,3,4,5]","[0]","[null]")) {
            mvc.perform(post(URL).with(user("teste")).with(csrf()).contentType("application/json").content("{\"ids\":"+ids+"}"))
                    .andExpect(status().isBadRequest());
        }
        verify(service,times(1)).atualizar(anyList(),anyString());
    }
    @Test void sessaoExternaAusenteInformaReconexaoSemExporDadosExternos() throws Exception {
        when(service.atualizar(anyList(),anyString())).thenThrow(new AreaCentralProductException(AreaCentralProductException.Code.SESSION_REQUIRED));
        mvc.perform(post(URL).with(user("teste")).with(csrf()).contentType("application/json").content("{\"ids\":[1]}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("AREA_CENTRAL_SESSION_REQUIRED"));
    }
}
