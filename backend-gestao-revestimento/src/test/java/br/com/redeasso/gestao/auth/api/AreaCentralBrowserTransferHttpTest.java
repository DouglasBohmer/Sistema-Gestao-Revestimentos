package br.com.redeasso.gestao.auth.api;

import br.com.redeasso.gestao.auth.application.AreaCentralAuthenticationService;
import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.api.AreaCentralBrowserTransferController;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import br.com.redeasso.gestao.shared.api.*;
import br.com.redeasso.gestao.shared.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import tools.jackson.databind.ObjectMapper;
import java.util.Collections;
import static org.assertj.core.api.Assertions.*;
import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {AreaCentralBrowserTransferController.class, AuthSessionController.class}, properties = {
        "redeasso.integration.area-central.enabled=true",
        "AREA_CENTRAL_SESSION_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
})
@EnableConfigurationProperties(AreaCentralProperties.class)
@Import({SecurityConfiguration.class, AreaCentralBrowserTransferService.class, AreaCentralAuthenticationService.class,
        ApiExceptionHandler.class, ApiErrorResponseWriter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class AreaCentralBrowserTransferHttpTest {
    private static final String BASE = "/api/auth/area-central/browser-transfers";
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @MockitoBean AreaCentralSessionVerifier verifier;

    @Test void extensaoNaoAutenticaDiretamenteSomenteSessaoOriginalConcluiComCsrf() throws Exception {
        when(verifier.verify(any())).thenAnswer(call -> new AreaCentralAuthenticatedLogin("Área Central", call.getArgument(0)));
        var session = new MockHttpSession();
        String previousId = session.getId();
        String token = start(session);
        mvc.perform(post(BASE + "/receive").contentType(APPLICATION_JSON).content(payload(token)))
                .andExpect(status().isNoContent()).andExpect(content().string(""));
        mvc.perform(get("/api/auth/session").session(session)).andExpect(jsonPath("$.authenticated").value(false));
        mvc.perform(get(BASE + "/current").session(session))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("READY_TO_COMPLETE"))
                .andExpect(content().string(not(containsString("cookie-ficticio-privado"))))
                .andExpect(content().string(not(containsString(token))));
        mvc.perform(post(BASE + "/complete").session(new MockHttpSession()).with(csrf())).andExpect(status().isNotFound());
        mvc.perform(post(BASE + "/complete").session(session)).andExpect(status().isForbidden());
        mvc.perform(post(BASE + "/complete").session(session).with(csrf()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.username").value("Área Central"))
                .andExpect(jsonPath("$.areaCentralConnected").value(true))
                .andExpect(content().string(not(containsString("cookie-ficticio-privado"))));
        assertThat(session.getId()).isNotEqualTo(previousId);
        var attributes = Collections.list(session.getAttributeNames()).stream().map(name -> String.valueOf(session.getAttribute(name))).toList();
        assertThat(attributes).noneMatch(value -> value.contains("cookie-ficticio-privado") || value.contains(token));
        assertThat(attributes).anyMatch(value -> value.startsWith("v1."));
        mvc.perform(get("/api/auth/session").session(session)).andExpect(jsonPath("$.authenticated").value(true));
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
    }

    @Test void criarCancelarEConcluirExigemCsrf() throws Exception {
        mvc.perform(post(BASE)).andExpect(status().isForbidden());
        mvc.perform(delete(BASE + "/current")).andExpect(status().isForbidden());
        mvc.perform(post(BASE + "/complete")).andExpect(status().isForbidden());
        verifyNoInteractions(verifier);
    }

    @Test void rejeitaCorpoGiganteAntesDaDesserializacaoSemValidarNaRede() throws Exception {
        mvc.perform(post(BASE + "/receive").contentType(APPLICATION_JSON).content("x".repeat(33_000)))
                .andExpect(status().is(413)).andExpect(content().string(not(containsString("xxxxxxxxxx"))));
        verifyNoInteractions(verifier);
    }

    @Test void logoutRevogaTransferenciaAindaPendente() throws Exception {
        var session = new MockHttpSession();
        String token = start(session);
        mvc.perform(post("/api/auth/logout").session(session).with(csrf())).andExpect(status().isNoContent());
        mvc.perform(post(BASE + "/receive").contentType(APPLICATION_JSON).content(payload(token)))
                .andExpect(status().isNotFound());
        verifyNoInteractions(verifier);
    }

    @Test void rejeitaNonceInvalidoAnonimoOuReplaySemExporCookies() throws Exception {
        mvc.perform(post(BASE + "/receive").contentType(APPLICATION_JSON).content(payload("a".repeat(43))))
                .andExpect(status().isNotFound()).andExpect(content().string(not(containsString("cookie-ficticio-privado"))));
        mvc.perform(post(BASE + "/receive").contentType(APPLICATION_JSON).content(payload("curto")))
                .andExpect(status().isBadRequest());
        var session = new MockHttpSession();
        String token = start(session);
        when(verifier.verify(any())).thenThrow(new AreaCentralIntegrationUnavailableException("Sessão recusada"));
        mvc.perform(post(BASE + "/receive").contentType(APPLICATION_JSON).content(payload(token))).andExpect(status().isServiceUnavailable());
        mvc.perform(post(BASE + "/receive").contentType(APPLICATION_JSON).content(payload(token))).andExpect(status().isConflict());
        mvc.perform(post(BASE + "/complete").session(session).with(csrf())).andExpect(status().isConflict());
        verify(verifier, times(1)).verify(any());
    }

    private String start(MockHttpSession session) throws Exception {
        var result = mvc.perform(post(BASE).session(session).with(csrf())).andExpect(status().isCreated()).andReturn();
        return mapper.readTree(result.getResponse().getContentAsString()).path("transferToken").asText();
    }
    private String payload(String token) {
        return """
                {"transferToken":"%s","cookies":[{"name":"PHPSESSID","value":"cookie-ficticio-privado",
                "domain":"redeasso.areacentral.com.br","path":"/","secure":true,"httpOnly":true}]}
                """.formatted(token);
    }
}
