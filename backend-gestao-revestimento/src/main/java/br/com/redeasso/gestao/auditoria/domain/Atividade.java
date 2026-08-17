package br.com.redeasso.gestao.auditoria.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "atividades")
public class Atividade {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tipo", length = 50, nullable = false)
    private String tipo;

    @Column(name = "descricao", length = 500, nullable = false)
    private String descricao;

    @Column(name = "piso_nome", length = 200)
    private String pisoNome;

    @Column(name = "criado_em", nullable = false, updatable = false)
    private Instant createdAt;

    protected Atividade() {
    }

    public Atividade(String tipo, String descricao, String pisoNome) {
        this.tipo = textoObrigatorio(tipo, "tipo");
        this.descricao = textoObrigatorio(descricao, "descricao");
        this.pisoNome = textoOpcional(pisoNome);
    }

    @PrePersist
    private void antesDePersistir() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    private static String textoObrigatorio(String valor, String campo) {
        String normalizado = textoOpcional(valor);
        if (normalizado == null) {
            throw new IllegalArgumentException(campo + " é obrigatório");
        }
        return normalizado;
    }

    private static String textoOpcional(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }

    public Long getId() {
        return id;
    }

    public String getTipo() {
        return tipo;
    }

    public String getDescricao() {
        return descricao;
    }

    public String getPisoNome() {
        return pisoNome;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
