CREATE TABLE mapas (
    id BIGSERIAL PRIMARY KEY,
    nome VARCHAR(160) NOT NULL,
    linhas INTEGER NOT NULL CHECK (linhas BETWEEN 1 AND 26),
    colunas INTEGER NOT NULL CHECK (colunas BETWEEN 1 AND 50),
    label_top VARCHAR(160) NOT NULL DEFAULT '',
    label_bottom VARCHAR(160) NOT NULL DEFAULT '',
    label_left VARCHAR(160) NOT NULL DEFAULT '',
    label_right VARCHAR(160) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mapa_celulas (
    id BIGSERIAL PRIMARY KEY,
    mapa_id BIGINT NOT NULL REFERENCES mapas(id) ON DELETE CASCADE,
    posicao VARCHAR(3) NOT NULL,
    ordem INTEGER NOT NULL CHECK (ordem BETWEEN 0 AND 3),
    piso_id BIGINT NOT NULL REFERENCES pisos(id) ON DELETE RESTRICT,
    m2 NUMERIC(18, 6) NOT NULL CHECK (m2 >= 0),
    caixas INTEGER NOT NULL CHECK (caixas >= 0),
    CONSTRAINT ck_mapa_celula_posicao CHECK (posicao ~ '^[A-Z]([1-9]|[1-4][0-9]|50)$'),
    CONSTRAINT ck_mapa_celula_quantidade CHECK (m2 > 0 OR caixas > 0),
    CONSTRAINT uk_mapa_celula_ordem UNIQUE (mapa_id, posicao, ordem),
    CONSTRAINT uk_mapa_celula_piso UNIQUE (mapa_id, posicao, piso_id)
);

CREATE INDEX idx_mapa_celulas_mapa_posicao
    ON mapa_celulas (mapa_id, posicao, ordem);

CREATE INDEX idx_mapa_celulas_piso
    ON mapa_celulas (piso_id);
