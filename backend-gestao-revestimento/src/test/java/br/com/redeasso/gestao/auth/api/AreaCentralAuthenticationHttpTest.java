package br.com.redeasso.gestao.auth.api;

import br.com.redeasso.gestao.auth.application.AreaCentralAuthenticationService;
import br.com.redeasso.gestao.integracao.areacentral.AreaCentralProperties;
import br.com.redeasso.gestao.integracao.areacentral.api.AreaCentralLoginController;
import br.com.redeasso.gestao.integracao.areacentral.application.*;
import br.com.redeasso.gestao.shared.api.ApiErrorResponseWriter;
import br.com.redeasso.gestao.shared.api.ApiExceptionHandler;
import br.com.redeasso.gestao.shared.security.JsonAccessDeniedHandler;
import br.com.redeasso.gestao.shared.security.JsonAuthenticationEntryPoint;
import br.com.redeasso.gestao.shared.security.SecurityConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Collections;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = {AreaCentralLoginController.class, AuthSessionController.class}, properties = {
        "redeasso.integration.area-central.enabled=true",
        "redeasso.integration.area-central.interactive-url=https://api.example/vnc.html",
        "redeasso.integration.area-central.browser-service-key=chave-interna-ficticia",
        "redeasso.integration.area-central.interactive-token-secret=segredo-ficticio",
        "AREA_CENTRAL_SESSION_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
})
@EnableConfigurationProperties(AreaCentralProperties.class)
@Import({SecurityConfiguration.class, AreaCentralLoginService.class, AreaCentralAuthenticationService.class,
        ApiExceptionHandler.class, ApiErrorResponseWriter.class,
        JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class AreaCentralAuthenticationHttpTest {
    @Autowired MockMvc mvc;
    @MockitoBean AreaCentralBrowserGateway browser;

    @Test
    void loginRecebeSenhaTransitoriaProtegeCookiesEMantemSessaoNasProximasRequisicoes() throws Exception {
        when(browser.open(any(), anyString(), any(), eq("usuario-ficticio"), eq("senha-ficticia")))
                .thenReturn(new AreaCentralBrowserSession("navegador-ficticio"));
        when(browser.loginStatus(anyString())).thenReturn("AUTHENTICATING");
        var session = new MockHttpSession();
        String previousId = session.getId();

        mvc.perform(post("/api/auth/area-central/attempts").session(session).with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("{\"username\":\"usuario-ficticio\",\"password\":\"senha-ficticia\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("AUTHENTICATING"))
                .andExpect(content().string(not(containsString("senha-ficticia"))));

        when(browser.loginStatus(anyString())).thenReturn("READY_TO_COMPLETE");
        when(browser.cookies(anyString())).thenReturn(List.of(new AreaCentralCookie(
                "PHPSESSID", "cookie-ficticio-privado", "redeasso.areacentral.com.br", "/", true, true, "Lax", null)));
        mvc.perform(post("/api/auth/area-central/attempts/complete").session(session).with(csrf()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.areaCentralConnected").value(true))
                .andExpect(content().string(not(containsString("cookie-ficticio-privado"))));

        assertThat(session.getId()).isNotEqualTo(previousId);
        var attributes = Collections.list(session.getAttributeNames()).stream()
                .map(name -> String.valueOf(session.getAttribute(name))).toList();
        assertThat(attributes).noneMatch(value -> value.contains("senha-ficticia") || value.contains("cookie-ficticio-privado"));
        assertThat(attributes).anyMatch(value -> value.startsWith("v1."));

        mvc.perform(get("/api/auth/session").session(session))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.username").value("usuario-ficticio"))
                .andExpect(jsonPath("$.areaCentralConnected").value(true));
        mvc.perform(post("/api/auth/logout").session(session).with(csrf()))
                .andExpect(status().isNoContent());
        assertThat(session.isInvalid()).isTrue();
        verify(browser).close("navegador-ficticio");
    }

    @Test
    void credenciaisExternasTambemExigemCsrf() throws Exception {
        mvc.perform(post("/api/auth/area-central/attempts").contentType(APPLICATION_JSON)
                        .content("{\"username\":\"usuario-ficticio\",\"password\":\"senha-ficticia\"}"))
                .andExpect(status().isForbidden());
        verifyNoInteractions(browser);
    }
}
