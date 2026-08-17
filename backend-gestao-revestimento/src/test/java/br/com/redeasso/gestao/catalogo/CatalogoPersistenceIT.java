package br.com.redeasso.gestao.catalogo;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.catalogo.application.PisoEmUsoException;
import br.com.redeasso.gestao.catalogo.application.PisoService;
import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.infrastructure.PisoRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.postgresql.PostgreSQLContainer;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@Testcontainers
@ActiveProfiles("integration")
@SpringBootTest
class CatalogoPersistenceIT {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer POSTGRESQL = new PostgreSQLContainer("postgres:17-alpine")
            .withDatabaseName("redeasso_catalogo_it")
            .withUsername("redeasso_test")
            .withPassword("redeasso_test");

    @Autowired
    private PisoService pisoService;

    @Autowired
    private PisoRepository pisoRepository;

    @Autowired
    private AtividadeService atividadeService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @Transactional
    void migraSeedFiltraPersisteEAuditaSemApagarHistorico() {
        assertThat(pisoService.listar(null, null, null))
                .extracting(Piso::getNome)
                .containsExactly("Portinari Cimento Bold", "Elizeu Rustic Bege");
        assertThat(pisoService.listar("cimento", "Interno", "Porcelanato"))
                .extracting(Piso::getCodigoLoja)
                .containsExactly("L-001");
        assertThat(pisoService.buscarPorCodigo("ELZ-002").getCodigoLoja()).isEqualTo("L-002");

        Piso cadastrado = pisoService.cadastrar(novoPiso());

        assertThat(cadastrado.getId()).isNotNull();
        assertThat(cadastrado.getCreatedAt()).isNotNull();
        assertThat(pisoRepository.contarPorTipo())
                .extracting(PisoRepository.PisosPorTipo::getTipo)
                .containsExactly("Porcelanato", "Cerâmica");
        assertThat(pisoRepository.contarPorTipo())
                .extracting(PisoRepository.PisosPorTipo::getTotal)
                .containsExactly(2L, 1L);
        assertThat(atividadeService.listarRecentes())
                .first()
                .satisfies(atividade -> {
                    assertThat(atividade.getTipo()).isEqualTo("cadastro");
                    assertThat(atividade.getPisoNome()).isEqualTo("Novo Piso");
                });

        long atividadesAntesDaExclusao = atividadeService.listarRecentes().size();
        pisoService.excluir(cadastrado.getId());

        assertThat(pisoRepository.existsById(cadastrado.getId())).isFalse();
        assertThat(atividadeService.listarRecentes()).hasSize((int) atividadesAntesDaExclusao + 1);
        assertThat(atividadeService.listarRecentes().getFirst().getDescricao())
                .isEqualTo("Piso Novo Piso excluído");
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void bancoImpedeExcluirPisoVinculadoAoMapa() {
        Long mapaId = jdbcTemplate.queryForObject("""
                INSERT INTO mapas (nome, linhas, colunas)
                VALUES ('Mapa de teste', 1, 1)
                RETURNING id
                """, Long.class);
        jdbcTemplate.update("""
                INSERT INTO mapa_celulas (mapa_id, posicao, ordem, piso_id, m2, caixas)
                VALUES (?, 'A1', 0, 1, 1.44, 1)
                """, mapaId);

        try {
            assertThatThrownBy(() -> pisoService.excluir(1L))
                    .isInstanceOf(PisoEmUsoException.class)
                    .hasMessage("Piso não pode ser excluído porque está vinculado a um mapa");
            assertThat(pisoRepository.existsById(1L)).isTrue();
        } finally {
            jdbcTemplate.update("DELETE FROM mapas WHERE id = ?", mapaId);
        }
    }

    private static DadosPiso novoPiso() {
        return new DadosPiso(
                "Novo Piso",
                "REDE-NOVO",
                "LOJA-NOVO",
                new BigDecimal("60"),
                new BigDecimal("60"),
                new BigDecimal("2"),
                new BigDecimal("4"),
                new BigDecimal("1.44"),
                "Interno",
                "Porcelanato",
                4,
                true,
                null,
                null,
                new BigDecimal("80.50"));
    }
}
