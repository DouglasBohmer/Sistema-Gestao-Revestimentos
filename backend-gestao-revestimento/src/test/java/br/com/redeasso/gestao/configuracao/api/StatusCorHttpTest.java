package br.com.redeasso.gestao.configuracao.api;

import br.com.redeasso.gestao.configuracao.application.StatusCorService;
import br.com.redeasso.gestao.configuracao.application.StatusConfiguracaoInvalidaException;
import br.com.redeasso.gestao.shared.api.*;
import br.com.redeasso.gestao.shared.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(StatusCorController.class)
@Import({SecurityConfiguration.class, ApiExceptionHandler.class, ApiErrorResponseWriter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class StatusCorHttpTest {
    @Autowired MockMvc mvc;
    @MockitoBean StatusCorService service;
    static final String URL = "/api/configuracoes/status";
    static final String VALID = "{\"status\":[" + java.util.stream.Stream.of("PADRAO", "ACABAR", "NEGOCIACAO", "FORA_DE_LINHA", "PRODUTO_LOCAL")
            .map(code -> "{\"codigo\":\"" + code + "\",\"cor\":\"#15803d\",\"versao\":0}")
            .collect(java.util.stream.Collectors.joining(",")) + "]}";
    @Test void exigeSessaoECsrf() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(put(URL).with(csrf()).contentType("application/json").content(VALID)).andExpect(status().isUnauthorized());
        mvc.perform(put(URL).with(user("teste")).contentType("application/json").content(VALID)).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void aceitaSomenteCincoCodigosCoresHexEVersoes() throws Exception {
        for (String invalid : new String[]{"{}", "{\"status\":[]}", VALID.replace("#15803d", "javascript:alert(1)"), VALID.replace("PADRAO", "OUTRO"), VALID.replace("\"versao\":0", "\"versao\":null"), VALID.replace("\"versao\":0", "\"versao\":-1")}) {
            mvc.perform(put(URL).with(user("teste")).with(csrf()).contentType("application/json").content(invalid)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void consultaSalvaETraduzDuplicidadeEConflitoSemDadosInternos() throws Exception {
        when(service.consultar()).thenReturn(java.util.List.of(new StatusCorService.Valor("PADRAO", "#15803d", 0)));
        mvc.perform(get(URL).with(user("teste"))).andExpect(status().isOk()).andExpect(jsonPath("$[0].cor").value("#15803d"));
        mvc.perform(put(URL).with(user("teste")).with(csrf()).contentType("application/json").content(VALID)).andExpect(status().isOk());
        when(service.salvar(anyList())).thenThrow(new StatusConfiguracaoInvalidaException());
        mvc.perform(put(URL).with(user("teste")).with(csrf()).contentType("application/json").content(VALID.replace("ACABAR", "PADRAO"))).andExpect(status().isBadRequest());
        doThrow(new ObjectOptimisticLockingFailureException("segredo", 1)).when(service).salvar(anyList());
        mvc.perform(put(URL).with(user("teste")).with(csrf()).contentType("application/json").content(VALID)).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EDIT_CONFLICT"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("segredo"))));
    }
}
