package br.com.redeasso.gestao;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@ActiveProfiles("integration")
@AutoConfigureMockMvc
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class GestaoRevestimentoApplicationIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRESQL = new PostgreSQLContainer("postgres:17-alpine")
            .withDatabaseName("redeasso_integration")
            .withUsername("redeasso_test")
            .withPassword("redeasso_test");

    @Autowired
    private DataSource dataSource;

    @Autowired
    private Flyway flyway;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void iniciaComPostgresqlRealEDatabaseAtualizadoPeloFlyway() throws Exception {
        try (var connection = dataSource.getConnection()) {
            assertThat(connection.getMetaData().getDatabaseProductName()).isEqualTo("PostgreSQL");
            assertThat(connection.getCatalog()).isEqualTo("redeasso_integration");
        }

        assertThat(flyway.info().pending()).isEmpty();
        assertThat(jdbcTemplate.queryForObject(
                "SELECT to_regclass('public.spring_session')::text",
                String.class)).isEqualTo("spring_session");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM parametros_sistema",
                Integer.class)).isEqualTo(9);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT valor FROM parametros_sistema WHERE chave = 'PRECO_LUCRO_PERCENTUAL'",
                BigDecimal.class)).isEqualByComparingTo("90");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT valor FROM parametros_sistema WHERE chave = 'PRECO_DESCONTO_PERCENTUAL'",
                BigDecimal.class)).isEqualByComparingTo("12");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT valor FROM parametros_sistema WHERE chave = 'NIVELADOR_INTERVALO_CM'",
                BigDecimal.class)).isEqualByComparingTo("40");
        assertThat(jdbcTemplate.queryForObject(
                "SELECT valor FROM parametros_sistema WHERE chave = 'NIVELADOR_PECAS_PACOTE'",
                BigDecimal.class)).isEqualByComparingTo("100");
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM pisos", Integer.class)).isEqualTo(261);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM pisos WHERE ativo", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("""
                SELECT SUM(jsonb_array_length(dados_legado -> 'fontes'))
                FROM pisos
                """, Integer.class)).isEqualTo(264);
        assertThat(jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM pisos
                WHERE NULLIF(BTRIM(codigo_rede), '') IS NULL
                  AND NULLIF(BTRIM(codigo_loja), '') IS NULL
                """, Integer.class)).isZero();
    }

    @Test
    void usaORepositorioCsrfConfiguradoNoContextoCompleto() throws Exception {
        mockMvc.perform(get("/api/auth/csrf"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.headerName").value("X-XSRF-TOKEN"));
    }
}
