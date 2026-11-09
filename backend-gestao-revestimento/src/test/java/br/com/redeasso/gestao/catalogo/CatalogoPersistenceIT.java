package br.com.redeasso.gestao.catalogo;

import br.com.redeasso.gestao.auditoria.application.AtividadeService;
import br.com.redeasso.gestao.catalogo.application.PisoEmUsoException;
import br.com.redeasso.gestao.catalogo.application.PisoService;
import br.com.redeasso.gestao.catalogo.domain.DadosPiso;
import br.com.redeasso.gestao.catalogo.domain.Piso;
import br.com.redeasso.gestao.catalogo.domain.AcabamentoBorda;
import br.com.redeasso.gestao.catalogo.domain.ClassificacaoUso;
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

    @Autowired
    private br.com.redeasso.gestao.configuracao.application.ParametrosPrecoService parametrosPreco;

    @Autowired private br.com.redeasso.gestao.calculo.application.CalculoService calculos;
    @Autowired private br.com.redeasso.gestao.calculo.application.CalculoHistoricoService historico;
    @Autowired private br.com.redeasso.gestao.configuracao.application.StatusCorService cores;
    @Autowired private jakarta.persistence.EntityManager entityManager;

    @Test
    @Transactional
    void historicoReabreSnapshotJsonbSemRecalcularMesmoAposExcluirPiso() {
        Piso piso = pisoService.cadastrar(novoPiso());
        var resultado = calculos.calcular(piso.getId(), null, null, 3L, null);
        entityManager.flush();
        entityManager.clear();
        long id = historico.recentes().getFirst().id();
        assertThat(jdbcTemplate.queryForObject("SELECT parametros->>'MARGEM_QUEBRA' FROM calculos_historico WHERE id=?", String.class, id)).isEqualTo("0");
        pisoService.excluir(piso.getId());
        int atividades = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM atividades", Integer.class);
        var reaberto = historico.reabrir(id);
        assertThat(reaberto).usingRecursiveComparison().withComparatorForType(BigDecimal::compareTo, BigDecimal.class).isEqualTo(resultado);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM atividades", Integer.class)).isEqualTo(atividades);
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM calculos_historico", Integer.class)).isEqualTo(1);
        for (int i = 0; i < 16; i++) jdbcTemplate.update("INSERT INTO calculos_historico (piso_nome,criado_em,resultado,parametros) SELECT piso_nome,criado_em+INTERVAL '1 day',resultado,parametros FROM calculos_historico WHERE id=?", id);
        entityManager.clear();
        assertThat(historico.recentes()).hasSize(15).noneMatch(item -> item.id() == id);
    }

    @Test
    @Transactional
    void coresPersistemComVersaoEAuditoriaSemAlterarProdutos() {
        var antes = cores.consultar();
        var alteradas = antes.stream().map(item -> new br.com.redeasso.gestao.configuracao.application.StatusCorService.Valor(item.codigo(), "#123456", item.versao())).toList();
        var salvas = cores.salvar(alteradas);
        entityManager.clear();
        assertThat(cores.consultar()).containsExactlyElementsOf(salvas);
        assertThat(salvas).allSatisfy(item -> {assertThat(item.cor()).isEqualTo("#123456"); assertThat(item.versao()).isEqualTo(1);});
        assertThat(jdbcTemplate.queryForObject("SELECT COUNT(*) FROM pisos WHERE ativo", Integer.class)).isZero();
        assertThatThrownBy(() -> cores.salvar(antes)).isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);
    }

    @Test
    @Transactional
    void pisosRecentesOrdenamPorCadastroEIdNaoPelaAtualizacaoDeEstoque() {
        Piso novo = pisoService.cadastrar(novoPiso());
        entityManager.flush();
        jdbcTemplate.update("UPDATE pisos SET atualizado_em=NOW()+INTERVAL '1 day' WHERE id=(SELECT MIN(id) FROM pisos)");
        assertThat(pisoRepository.findTop15ByOrderByCreatedAtDescIdDesc()).hasSize(15).first().satisfies(item -> assertThat(item.getId()).isEqualTo(novo.getId()));
    }

    @Test
    @Transactional
    void salvaParDeParametrosComVersaoAuditoriaERecusaEdicaoAntiga() {
        var antes = parametrosPreco.consultar();
        var salvo = parametrosPreco.salvar(new BigDecimal("95.5"), BigDecimal.TEN, antes.versaoMargem(), antes.versaoDesconto());
        assertThat(salvo.versaoMargem()).isGreaterThan(antes.versaoMargem());
        assertThat(salvo.versaoDesconto()).isGreaterThan(antes.versaoDesconto());
        assertThat(jdbcTemplate.queryForObject("SELECT valor FROM parametros_sistema WHERE chave='PRECO_LUCRO_PERCENTUAL'",BigDecimal.class)).isEqualByComparingTo("95.5");
        assertThat(jdbcTemplate.queryForObject("SELECT valor FROM parametros_sistema WHERE chave='PRECO_DESCONTO_PERCENTUAL'",BigDecimal.class)).isEqualByComparingTo("10");
        assertThat(atividadeService.listarRecentes()).first().satisfies(atividade -> assertThat(atividade.getTipo()).isEqualTo("configuracao"));
        assertThatThrownBy(() -> parametrosPreco.salvar(BigDecimal.ZERO,BigDecimal.ZERO,antes.versaoMargem(),antes.versaoDesconto()))
                .isInstanceOf(org.springframework.orm.ObjectOptimisticLockingFailureException.class);
    }

    @Test
    @Transactional
    void migraCatalogoLegadoFiltraPersisteEAuditaSemApagarHistorico() {
        assertThat(pisoService.listar(null, null, null))
                .extracting(Piso::getNome)
                .hasSize(261)
                .contains("PISO ALMEIDA 42X83 LEIRIA NATURAL BR");
        assertThat(pisoService.buscarPorCodigo("2180593").getClassificacaoUso())
                .isEqualTo(ClassificacaoUso.LA);

        Piso cadastrado = pisoService.cadastrar(novoPiso());

        assertThat(cadastrado.getId()).isNotNull();
        assertThat(cadastrado.getCreatedAt()).isNotNull();
        assertThat(cadastrado.getLinkPaginacao())
                .isEqualTo("https://exemplo.com/paginacao-ambiente.webp");
        assertThat(pisoRepository.contarPorTipo())
                .extracting(PisoRepository.PisosPorTipo::getTipo)
                .contains("Porcelanato");
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
        Long pisoId = jdbcTemplate.queryForObject("SELECT MIN(id) FROM pisos", Long.class);
        jdbcTemplate.update("""
                INSERT INTO mapa_celulas (mapa_id, posicao, ordem, piso_id, m2, caixas)
                VALUES (?, 'A1', 0, ?, 1.44, 1)
                """, mapaId, pisoId);

        try {
            assertThatThrownBy(() -> pisoService.excluir(pisoId))
                    .isInstanceOf(PisoEmUsoException.class)
                    .hasMessage("Piso não pode ser excluído porque está vinculado a um mapa");
            assertThat(pisoRepository.existsById(pisoId)).isTrue();
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
                ClassificacaoUso.LD,
                AcabamentoBorda.RETIFICADO,
                null,
                null,
                null,
                "https://exemplo.com/paginacao-ambiente.webp",
                null,
                new BigDecimal("80.50"),
                BigDecimal.ZERO,
                true);
    }
}
