package br.com.redeasso.gestao.catalogo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "pisos")
public class Piso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nome", length = 200, nullable = false)
    private String nome;

    @Column(name = "codigo_rede", length = 100)
    private String codigoRede;

    @Column(name = "codigo_loja", length = 100)
    private String codigoLoja;

    @Column(name = "largura", precision = 18, scale = 6)
    private BigDecimal largura;

    @Column(name = "altura", precision = 18, scale = 6)
    private BigDecimal altura;

    @Column(name = "rejunte", precision = 18, scale = 6)
    private BigDecimal rejunte;

    @Column(name = "pecas_por_caixa", precision = 18, scale = 6)
    private BigDecimal pecasPorCaixa;

    @Column(name = "m2_por_caixa", precision = 18, scale = 6, nullable = false)
    private BigDecimal m2PorCaixa;

    @Column(name = "local_de_uso", length = 255)
    private String localDeUso;

    @Column(name = "tipo_piso", length = 100)
    private String tipoPiso;

    @Enumerated(EnumType.STRING)
    @Column(name = "classificacao_uso", length = 2)
    private ClassificacaoUso classificacaoUso;

    @Enumerated(EnumType.STRING)
    @Column(name = "acabamento_bordas", length = 20, nullable = false)
    private AcabamentoBorda acabamentoBordas;

    @Column(name = "link_site", length = 2048)
    private String linkSite;

    @Column(name = "link_foto", length = 2048)
    private String linkFoto;

    @Column(name = "link_foto_origem", length = 2048)
    private String linkFotoOrigem;

    @Column(name = "link_area_central", length = 2048)
    private String linkAreaCentral;

    @Column(name = "valor", precision = 18, scale = 6, nullable = false)
    private BigDecimal valor;

    @Column(name = "estoque_m2", precision = 18, scale = 6, nullable = false)
    private BigDecimal estoqueM2;

    @Column(name = "status_area_central", length = 100)
    private String statusAreaCentral;

    @Column(name = "ultima_consulta_area_central_em")
    private Instant ultimaConsultaAreaCentralEm;

    @Column(name = "ativo", nullable = false)
    private boolean ativo;

    @Enumerated(EnumType.STRING)
    @Column(name = "origem_valor", length = 20, nullable = false)
    private OrigemDadoProduto origemValor;

    @Enumerated(EnumType.STRING)
    @Column(name = "origem_estoque", length = 20, nullable = false)
    private OrigemDadoProduto origemEstoque;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "atualizado_em")
    private Instant updatedAt;

    @Version
    @Column(name = "versao", nullable = false)
    private long versao;

    protected Piso() {
    }

    private Piso(DadosPiso dados) {
        aplicarDadosCadastrais(dados);
        valor = numeroNaoNegativoOuZero(dados.valor(), "valor");
        estoqueM2 = numeroNaoNegativoOuZero(dados.estoqueM2(), "estoqueM2");
        origemValor = dados.valor() == null
                ? OrigemDadoProduto.NAO_INFORMADO
                : OrigemDadoProduto.MANUAL;
        origemEstoque = dados.estoqueM2() == null
                ? OrigemDadoProduto.NAO_INFORMADO
                : OrigemDadoProduto.MANUAL;
        ativo = Boolean.TRUE.equals(dados.ativo());
    }

    public static Piso cadastrar(DadosPiso dados) {
        return new Piso(dados);
    }

    public void atualizar(DadosPiso dados) {
        aplicarDadosCadastrais(dados);
        if (dados.valor() != null && valor.compareTo(dados.valor()) != 0) {
            valor = numeroNaoNegativoOuZero(dados.valor(), "valor");
            origemValor = OrigemDadoProduto.MANUAL;
        }
        if (dados.estoqueM2() != null && estoqueM2.compareTo(dados.estoqueM2()) != 0) {
            estoqueM2 = numeroNaoNegativoOuZero(dados.estoqueM2(), "estoqueM2");
            origemEstoque = OrigemDadoProduto.MANUAL;
        }
        if (dados.ativo() != null) {
            ativo = dados.ativo();
        }
    }

    public void atualizarPelaAreaCentral(
            boolean encontrado,
            BigDecimal novoValor,
            BigDecimal novoEstoqueM2,
            String novoStatus,
            Instant consultadoEm) {
        ultimaConsultaAreaCentralEm = Objects.requireNonNull(consultadoEm, "consultadoEm é obrigatório");
        statusAreaCentral = textoOpcional(novoStatus);
        if (!encontrado) {
            ativo = false;
            return;
        }

        ativo = true;
        if (novoValor != null) {
            valor = numeroNaoNegativoOuZero(novoValor, "valor");
            origemValor = OrigemDadoProduto.AREA_CENTRAL;
        }
        if (novoEstoqueM2 != null) {
            estoqueM2 = numeroNaoNegativoOuZero(novoEstoqueM2, "estoqueM2");
            origemEstoque = OrigemDadoProduto.AREA_CENTRAL;
        }
    }

    private void aplicarDadosCadastrais(DadosPiso dados) {
        Objects.requireNonNull(dados, "Os dados do piso são obrigatórios");
        nome = textoObrigatorio(dados.nome(), "nome");
        codigoRede = textoOpcional(dados.codigoRede());
        codigoLoja = textoOpcional(dados.codigoLoja());
        if (codigoRede == null && codigoLoja == null) {
            throw new IllegalArgumentException("Ao menos um código ASSO ou CTC é obrigatório");
        }
        largura = dados.largura();
        altura = dados.altura();
        rejunte = dados.rejunte();
        pecasPorCaixa = dados.pecasPorCaixa();
        m2PorCaixa = Objects.requireNonNull(dados.m2PorCaixa(), "m2PorCaixa é obrigatório");
        if (m2PorCaixa.signum() <= 0) {
            throw new IllegalArgumentException("m2PorCaixa deve ser positivo");
        }
        localDeUso = textoOpcional(dados.localDeUso());
        tipoPiso = textoOpcional(dados.tipoPiso());
        classificacaoUso = dados.classificacaoUso();
        acabamentoBordas = Objects.requireNonNull(dados.acabamentoBordas(), "acabamentoBordas é obrigatório");
        linkSite = textoOpcional(dados.linkSite());
        String novaFotoOrigem = textoOpcional(dados.linkFotoOrigem());
        if (!Objects.equals(linkFotoOrigem, novaFotoOrigem)) {
            linkFotoOrigem = novaFotoOrigem;
            linkFoto = novaFotoOrigem;
        }
        linkAreaCentral = textoOpcional(dados.linkAreaCentral());
    }

    private static BigDecimal numeroNaoNegativoOuZero(BigDecimal valor, String campo) {
        BigDecimal normalizado = valor == null ? BigDecimal.ZERO : valor;
        if (normalizado.signum() < 0) {
            throw new IllegalArgumentException(campo + " não pode ser negativo");
        }
        return normalizado;
    }

    private static String textoObrigatorio(String valor, String campo) {
        String normalizado = textoOpcional(valor);
        if (normalizado == null) {
            throw new IllegalArgumentException(campo + " é obrigatório");
        }
        return normalizado;
    }

    private static String textoOpcional(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        return valor.trim();
    }

    @PrePersist
    private void antesDePersistir() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @PreUpdate
    private void antesDeAtualizar() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public String getCodigoRede() {
        return codigoRede;
    }

    public String getCodigoLoja() {
        return codigoLoja;
    }

    public BigDecimal getLargura() {
        return largura;
    }

    public BigDecimal getAltura() {
        return altura;
    }

    public BigDecimal getRejunte() {
        return rejunte;
    }

    public BigDecimal getPecasPorCaixa() {
        return pecasPorCaixa;
    }

    public BigDecimal getM2PorCaixa() {
        return m2PorCaixa;
    }

    public String getLocalDeUso() {
        return localDeUso;
    }

    public String getTipoPiso() {
        return tipoPiso;
    }

    public ClassificacaoUso getClassificacaoUso() {
        return classificacaoUso;
    }

    public AcabamentoBorda getAcabamentoBordas() {
        return acabamentoBordas;
    }

    public String getLinkSite() {
        return linkSite;
    }

    public String getLinkFoto() {
        return linkFoto;
    }

    public String getLinkFotoOrigem() {
        return linkFotoOrigem;
    }

    public String getLinkAreaCentral() {
        return linkAreaCentral;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public BigDecimal getEstoqueM2() {
        return estoqueM2;
    }

    public String getStatusAreaCentral() {
        return statusAreaCentral;
    }

    public Instant getUltimaConsultaAreaCentralEm() {
        return ultimaConsultaAreaCentralEm;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public OrigemDadoProduto getOrigemValor() {
        return origemValor;
    }

    public OrigemDadoProduto getOrigemEstoque() {
        return origemEstoque;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
