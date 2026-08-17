package br.com.redeasso.gestao.configuracao.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "parametros_sistema")
public class ParametroSistema {

    @Id
    @Column(name = "chave", length = 80, nullable = false, updatable = false)
    private String chave;

    @Column(name = "valor", precision = 18, scale = 6, nullable = false)
    private BigDecimal valor;

    @Column(name = "unidade", length = 30, nullable = false)
    private String unidade;

    @Column(name = "descricao", length = 255, nullable = false)
    private String descricao;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant criadoEm;

    @Column(name = "atualizado_em", nullable = false)
    private Instant atualizadoEm;

    @Version
    @Column(name = "versao", nullable = false)
    private long versao;

    protected ParametroSistema() {
    }

    public String getChave() {
        return chave;
    }

    public BigDecimal getValor() {
        return valor;
    }

    public String getUnidade() {
        return unidade;
    }

    public String getDescricao() {
        return descricao;
    }

    public Instant getCriadoEm() {
        return criadoEm;
    }

    public Instant getAtualizadoEm() {
        return atualizadoEm;
    }

    public long getVersao() {
        return versao;
    }
}
