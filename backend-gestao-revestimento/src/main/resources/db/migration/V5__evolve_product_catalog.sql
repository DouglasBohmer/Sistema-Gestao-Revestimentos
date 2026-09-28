ALTER TABLE pisos
    ALTER COLUMN codigo_loja DROP NOT NULL,
    ALTER COLUMN local_de_uso TYPE VARCHAR(255);

ALTER TABLE pisos
    RENAME COLUMN pei TO classificacao_uso;

ALTER TABLE pisos
    DROP CONSTRAINT pisos_pei_valido;

ALTER TABLE pisos
    ALTER COLUMN classificacao_uso TYPE VARCHAR(2)
        USING CASE classificacao_uso
            WHEN 1 THEN 'LA'
            WHEN 2 THEN 'LB'
            WHEN 3 THEN 'LC'
            WHEN 4 THEN 'LD'
            WHEN 5 THEN 'LE'
            ELSE NULL
        END;

ALTER TABLE pisos
    RENAME COLUMN retificado TO acabamento_bordas;

ALTER TABLE pisos
    ALTER COLUMN acabamento_bordas TYPE VARCHAR(20)
        USING CASE
            WHEN acabamento_bordas IS TRUE THEN 'RETIFICADO'
            ELSE 'BOLD'
        END,
    ALTER COLUMN acabamento_bordas SET DEFAULT 'BOLD',
    ALTER COLUMN acabamento_bordas SET NOT NULL;

ALTER TABLE pisos
    ADD COLUMN link_foto_origem VARCHAR(2048),
    ADD COLUMN link_area_central VARCHAR(2048),
    ADD COLUMN estoque_m2 NUMERIC(18, 6) NOT NULL DEFAULT 0,
    ADD COLUMN status_area_central VARCHAR(100),
    ADD COLUMN ultima_consulta_area_central_em TIMESTAMP WITH TIME ZONE,
    ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN origem_valor VARCHAR(20) NOT NULL DEFAULT 'NAO_INFORMADO',
    ADD COLUMN origem_estoque VARCHAR(20) NOT NULL DEFAULT 'NAO_INFORMADO',
    ADD COLUMN dados_legado JSONB;

UPDATE pisos
SET valor = COALESCE(valor, 0),
    estoque_m2 = 0,
    ativo = FALSE,
    link_foto_origem = link_foto,
    origem_valor = CASE WHEN valor IS NULL THEN 'NAO_INFORMADO' ELSE 'MANUAL' END,
    origem_estoque = 'NAO_INFORMADO';

ALTER TABLE pisos
    ALTER COLUMN valor SET DEFAULT 0,
    ALTER COLUMN valor SET NOT NULL,
    ADD CONSTRAINT pisos_codigo_obrigatorio CHECK (
        NULLIF(BTRIM(codigo_rede), '') IS NOT NULL
        OR NULLIF(BTRIM(codigo_loja), '') IS NOT NULL
    ),
    ADD CONSTRAINT pisos_classificacao_uso_valida CHECK (
        classificacao_uso IS NULL OR classificacao_uso IN ('LA', 'LB', 'LC', 'LD', 'LE', 'LF')
    ),
    ADD CONSTRAINT pisos_acabamento_bordas_valido CHECK (
        acabamento_bordas IN ('RETIFICADO', 'BOLD')
    ),
    ADD CONSTRAINT pisos_estoque_m2_nao_negativo CHECK (estoque_m2 >= 0),
    ADD CONSTRAINT pisos_origem_valor_valida CHECK (
        origem_valor IN ('NAO_INFORMADO', 'MANUAL', 'AREA_CENTRAL')
    ),
    ADD CONSTRAINT pisos_origem_estoque_valida CHECK (
        origem_estoque IN ('NAO_INFORMADO', 'MANUAL', 'AREA_CENTRAL')
    );

CREATE UNIQUE INDEX pisos_nome_normalizado_uk
    ON pisos (LOWER(BTRIM(nome)));

DELETE FROM atividades
WHERE piso_nome IN ('Portinari Cimento Bold', 'Elizeu Rustic Bege');

DELETE FROM pisos p
WHERE p.nome IN ('Portinari Cimento Bold', 'Elizeu Rustic Bege')
  AND NOT EXISTS (
      SELECT 1
      FROM mapa_celulas mc
      WHERE mc.piso_id = p.id
  );
