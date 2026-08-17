package br.com.redeasso.gestao.catalogo.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    @Column(name = "codigo_loja", length = 100, nullable = false)
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

    @Column(name = "local_de_uso", length = 100)
    private String localDeUso;

    @Column(name = "tipo_piso", length = 100)
    private String tipoPiso;

    @Column(name = "pei")
    private Integer pei;

    @Column(name = "retificado")
    private Boolean retificado;

    @Column(name = "link_site", length = 2048)
    private String linkSite;

    @Column(name = "link_foto", length = 2048)
    private String linkFoto;

    @Column(name = "valor", precision = 18, scale = 6)
    private BigDecimal valor;

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
        aplicar(dados);
    }

    public static Piso cadastrar(DadosPiso dados) {
        return new Piso(dados);
    }

    public void atualizar(DadosPiso dados) {
        aplicar(dados);
    }

    private void aplicar(DadosPiso dados) {
        Objects.requireNonNull(dados, "Os dados do piso são obrigatórios");
        nome = textoObrigatorio(dados.nome(), "nome");
        codigoRede = textoOpcional(dados.codigoRede());
        codigoLoja = textoObrigatorio(dados.codigoLoja(), "codigoLoja");
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
        pei = dados.pei();
        retificado = dados.retificado();
        linkSite = textoOpcional(dados.linkSite());
        linkFoto = textoOpcional(dados.linkFoto());
        valor = dados.valor();
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

    public Integer getPei() {
        return pei;
    }

    public Boolean getRetificado() {
        return retificado;
    }

    public String getLinkSite() {
        return linkSite;
    }

    public String getLinkFoto() {
        return linkFoto;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
