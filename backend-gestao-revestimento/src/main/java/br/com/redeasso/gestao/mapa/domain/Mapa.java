package br.com.redeasso.gestao.mapa.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "mapas")
public class Mapa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 160)
    private String nome;

    @Column(nullable = false)
    private int linhas;

    @Column(nullable = false)
    private int colunas;

    @Column(name = "label_top", nullable = false, length = 160)
    private String labelTop;

    @Column(name = "label_bottom", nullable = false, length = 160)
    private String labelBottom;

    @Column(name = "label_left", nullable = false, length = 160)
    private String labelLeft;

    @Column(name = "label_right", nullable = false, length = 160)
    private String labelRight;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Mapa() {
    }

    public Mapa(String nome, int linhas, int colunas, String labelTop, String labelBottom,
                String labelLeft, String labelRight) {
        this.nome = nome;
        this.linhas = linhas;
        this.colunas = colunas;
        this.labelTop = labelTop;
        this.labelBottom = labelBottom;
        this.labelLeft = labelLeft;
        this.labelRight = labelRight;
    }

    @PrePersist
    void onCreate() {
        var now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public void atualizar(String nome, String labelTop, String labelBottom, String labelLeft, String labelRight) {
        this.nome = nome;
        this.labelTop = labelTop;
        this.labelBottom = labelBottom;
        this.labelLeft = labelLeft;
        this.labelRight = labelRight;
        touch();
    }

    public void touch() {
        updatedAt = Instant.now();
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }

    public int getLinhas() {
        return linhas;
    }

    public int getColunas() {
        return colunas;
    }

    public String getLabelTop() {
        return labelTop;
    }

    public String getLabelBottom() {
        return labelBottom;
    }

    public String getLabelLeft() {
        return labelLeft;
    }

    public String getLabelRight() {
        return labelRight;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
