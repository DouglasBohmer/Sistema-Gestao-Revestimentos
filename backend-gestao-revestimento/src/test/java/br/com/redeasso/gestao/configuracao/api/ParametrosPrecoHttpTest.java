package br.com.redeasso.gestao.configuracao.api;

import br.com.redeasso.gestao.configuracao.application.ParametrosPrecoService;
import br.com.redeasso.gestao.shared.api.*;
import br.com.redeasso.gestao.shared.security.*;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.math.BigDecimal;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ParametrosPrecoController.class)
@Import({SecurityConfiguration.class, ApiExceptionHandler.class, ApiErrorResponseWriter.class, JsonAuthenticationEntryPoint.class, JsonAccessDeniedHandler.class})
class ParametrosPrecoHttpTest {
    @Autowired MockMvc mvc;
    @MockitoBean ParametrosPrecoService service;
    static final String URL = "/api/parametros/preco";
    static final String VALID = "{\"margemPercentual\":90,\"descontoPercentual\":12,\"versaoMargem\":0,\"versaoDesconto\":0}";
    @Test void exigeSessaoECsrf() throws Exception {
        mvc.perform(get(URL)).andExpect(status().isUnauthorized());
        mvc.perform(put(URL).with(csrf()).contentType("application/json").content(VALID)).andExpect(status().isUnauthorized());
        mvc.perform(put(URL).with(user("teste")).contentType("application/json").content(VALID)).andExpect(status().isForbidden());
        verifyNoInteractions(service);
    }
    @Test void consultaESalvaSomenteOsPercentuaisPermitidos() throws Exception {
        var valores = new ParametrosPrecoService.Valores(new BigDecimal("90"),new BigDecimal("12"),0,0);
        when(service.consultar()).thenReturn(valores);
        when(service.salvar(any(),any(),eq(0L),eq(0L))).thenReturn(valores);
        mvc.perform(get(URL).with(user("teste"))).andExpect(status().isOk()).andExpect(jsonPath("$.margemPercentual").value(90));
        mvc.perform(put(URL).with(user("teste")).with(csrf()).contentType("application/json").content(VALID)).andExpect(status().isOk());
    }
    @Test void rejeitaNegativosDescontoAcimaDeCemPrecisaoExcessivaEVersoesAusentes() throws Exception {
        for (String json : new String[]{VALID.replace(":90",":-1"),VALID.replace(":12",":101"),VALID.replace(":90",":1.1234567"),VALID.replace("\"versaoMargem\":0","\"versaoMargem\":null"),VALID.replace("\"versaoDesconto\":0","\"versaoDesconto\":-1")}) {
            mvc.perform(put(URL).with(user("teste")).with(csrf()).contentType("application/json").content(json)).andExpect(status().isBadRequest());
        }
        verifyNoInteractions(service);
    }
    @Test void conflitoNaoExpoeErroInterno() throws Exception {
        when(service.salvar(any(),any(),anyLong(),anyLong())).thenThrow(new ObjectOptimisticLockingFailureException("segredo-interno",1));
        mvc.perform(put(URL).with(user("teste")).with(csrf()).contentType("application/json").content(VALID))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EDIT_CONFLICT"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("segredo-interno"))));
    }
}
