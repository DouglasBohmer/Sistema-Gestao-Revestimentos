package br.com.redeasso.gestao.auth.api;

import br.com.redeasso.gestao.auth.application.LocalAuthenticationService;
import br.com.redeasso.gestao.auth.infrastructure.security.LocalAdminConfiguration;
import br.com.redeasso.gestao.shared.api.ApiErrorResponseWriter;
import br.com.redeasso.gestao.shared.api.ApiExceptionHandler;
import br.com.redeasso.gestao.shared.security.JsonAccessDeniedHandler;
import br.com.redeasso.gestao.shared.security.JsonAuthenticationEntryPoint;
import br.com.redeasso.gestao.shared.security.SecurityConfiguration;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ActiveProfiles("local")
@WebMvcTest(
        controllers = {LocalAuthController.class, AuthSessionController.class},
        properties = {
                "redeasso.auth.local.enabled=true",
                "redeasso.auth.local.username=admin",
                "redeasso.auth.local.password=admin"
        })
@Import({
        SecurityConfiguration.class,
        LocalAdminConfiguration.class,
        LocalAuthenticationService.class,
        ApiExceptionHandler.class,
        ApiErrorResponseWriter.class,
        JsonAuthenticationEntryPoint.class,
        JsonAccessDeniedHandler.class
})
class LocalAuthenticationHttpTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void sessaoAnonimaRetornaEstadoPublicoSemResponder401() throws Exception {
        mockMvc.perform(get("/api/auth/session").accept(APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_JSON))
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(jsonPath("$.username").value((Object) null))
                .andExpect(jsonPath("$.authType").value((Object) null))
                .andExpect(jsonPath("$.areaCentralConnected").value(false));
    }

    @Test
    void forneceTokenCsrfParaOperacoesDeEscrita() throws Exception {
        mockMvc.perform(get("/api/auth/csrf").accept(APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_JSON))
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.headerName").isNotEmpty())
                .andExpect(jsonPath("$.parameterName").value("_csrf"));
    }

    @Test
    void autenticaComOTokenFornecidoPeloEndpointCsrf() throws Exception {
        MvcResult csrfResult = mockMvc.perform(get("/api/auth/csrf").accept(APPLICATION_JSON))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = csrfResult.getResponse().getContentAsString();
        String token = JsonPath.read(responseBody, "$.token");
        String headerName = JsonPath.read(responseBody, "$.headerName");
        MockHttpSession session = (MockHttpSession) csrfResult.getRequest().getSession(false);
        assertThat(session).as("a consulta CSRF deve criar a sessão protegida").isNotNull();

        mockMvc.perform(post("/api/auth/local/login")
                        .session(session)
                        .header(headerName, token)
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"admin"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.authType").value("LOCAL"));
    }

    @Test
    void rejeitaLoginSemCsrf() throws Exception {
        mockMvc.perform(post("/api/auth/local/login")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"admin"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.path").value("/api/auth/local/login"));
    }

    @Test
    void autenticaAdminLocalESalvaIdentidadeNaSessao() throws Exception {
        MockHttpSession session = loginAsAdmin();

        mockMvc.perform(get("/api/auth/session")
                        .session(session)
                        .accept(APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.authType").value("LOCAL"))
                .andExpect(jsonPath("$.areaCentralConnected").value(false));
    }

    @Test
    void rejeitaCredenciaisInvalidasSemExporASenha() throws Exception {
        mockMvc.perform(post("/api/auth/local/login")
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"senha-incorreta"}
                                """))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.path").value("/api/auth/local/login"))
                .andExpect(jsonPath("$.timestamp").isNotEmpty())
                .andExpect(content().string(not(containsString("senha-incorreta"))));
    }

    @Test
    void validaCorpoDoLogin() throws Exception {
        mockMvc.perform(post("/api/auth/local/login")
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":""}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.path").value("/api/auth/local/login"));
    }

    @Test
    void logoutExigeCsrfENaoInvalidaSessaoQuandoTokenFalta() throws Exception {
        MockHttpSession session = loginAsAdmin();

        mockMvc.perform(post("/api/auth/logout").session(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"));

        assertThat(session.isInvalid()).isFalse();
    }

    @Test
    void logoutComCsrfInvalidaSessaoERetorna204() throws Exception {
        MockHttpSession session = loginAsAdmin();

        mockMvc.perform(post("/api/auth/logout")
                        .session(session)
                        .with(csrf()))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        assertThat(session.isInvalid()).isTrue();
    }

    private MockHttpSession loginAsAdmin() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/local/login")
                        .with(csrf())
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"admin"}
                                """))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_JSON))
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.authType").value("LOCAL"))
                .andExpect(jsonPath("$.areaCentralConnected").value(false))
                .andExpect(content().string(not(containsString("password"))))
                .andReturn();

        MockHttpSession session = (MockHttpSession) result.getRequest().getSession(false);
        assertThat(session).as("o login deve criar uma HttpSession").isNotNull();
        return session;
    }
}
