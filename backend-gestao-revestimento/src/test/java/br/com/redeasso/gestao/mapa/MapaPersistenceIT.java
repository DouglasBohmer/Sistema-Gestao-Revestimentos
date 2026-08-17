package br.com.redeasso.gestao.mapa;

import br.com.redeasso.gestao.mapa.api.dto.AtualizarCelulaRequest;
import br.com.redeasso.gestao.mapa.api.dto.CriarMapaRequest;
import br.com.redeasso.gestao.mapa.api.dto.MapaCelulaInput;
import br.com.redeasso.gestao.mapa.api.dto.MapaLabelsRequest;
import br.com.redeasso.gestao.mapa.application.MapaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@Testcontainers
@ActiveProfiles("integration")
@SpringBootTest(properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
})
class MapaPersistenceIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRESQL = new PostgreSQLContainer("postgres:17-alpine")
            .withDatabaseName("redeasso_mapas")
            .withUsername("redeasso_test")
            .withPassword("redeasso_test");

    @Autowired
    private MapaService service;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    void persisteMapaPosicoesEOrdemNoPostgresql() {
        List<Long> pisoIds = jdbcTemplate.queryForList("SELECT id FROM pisos ORDER BY id", Long.class);
        var mapa = service.criar(new CriarMapaRequest(
                "Galpão principal",
                3,
                4,
                new MapaLabelsRequest("Parede", "Corredor", "Entrada", "Fundos")));

        service.atualizarCelula(mapa.id(), "a1", new AtualizarCelulaRequest(List.of(
                new MapaCelulaInput(pisoIds.get(1), BigDecimal.ZERO, new BigDecimal("2")),
                new MapaCelulaInput(pisoIds.get(0), new BigDecimal("2.89"), BigDecimal.ZERO)),
                null, null, null));

        var recarregado = service.buscar(mapa.id());
        assertThat(recarregado.celulas()).containsOnlyKeys("A1");
        assertThat(recarregado.celulas().get("A1"))
                .extracting(item -> item.pisoId())
                .containsExactly(pisoIds.get(1), pisoIds.get(0));
        assertThat(recarregado.celulas().get("A1").get(0).m2()).isEqualByComparingTo("2.43");
        assertThat(recarregado.celulas().get("A1").get(1).caixas()).isEqualTo(3);
        assertThat(jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM mapa_celulas WHERE mapa_id = ?",
                Integer.class,
                mapa.id())).isEqualTo(2);
    }
}
