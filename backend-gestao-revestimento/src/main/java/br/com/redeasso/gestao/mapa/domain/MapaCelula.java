package br.com.redeasso.gestao.mapa.domain;

import br.com.redeasso.gestao.catalogo.domain.Piso;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.math.BigDecimal;

@Entity
@Table(name = "mapa_celulas", uniqueConstraints = {
        @UniqueConstraint(name = "uk_mapa_celula_ordem", columnNames = {"mapa_id", "posicao", "ordem"}),
        @UniqueConstraint(name = "uk_mapa_celula_piso", columnNames = {"mapa_id", "posicao", "piso_id"})
})
public class MapaCelula {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "mapa_id", nullable = false)
    private Mapa mapa;

    @Column(nullable = false, length = 3)
    private String posicao;

    @Column(nullable = false)
    private int ordem;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "piso_id", nullable = false)
    private Piso piso;

    @Column(nullable = false, precision = 18, scale = 6)
    private BigDecimal m2;

    @Column(nullable = false)
    private int caixas;

    protected MapaCelula() {
    }

    public MapaCelula(Mapa mapa, String posicao, int ordem, Piso piso, BigDecimal m2, int caixas) {
        this.mapa = mapa;
        this.posicao = posicao;
        this.ordem = ordem;
        this.piso = piso;
        this.m2 = m2;
        this.caixas = caixas;
    }

    public Mapa getMapa() {
        return mapa;
    }

    public String getPosicao() {
        return posicao;
    }

    public int getOrdem() {
        return ordem;
    }

    public Piso getPiso() {
        return piso;
    }

    public BigDecimal getM2() {
        return m2;
    }

    public int getCaixas() {
        return caixas;
    }
}
