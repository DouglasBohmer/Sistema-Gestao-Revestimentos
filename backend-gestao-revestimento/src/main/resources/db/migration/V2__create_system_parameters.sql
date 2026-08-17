CREATE TABLE parametros_sistema (
    chave VARCHAR(80) PRIMARY KEY,
    valor NUMERIC(18, 6) NOT NULL,
    unidade VARCHAR(30) NOT NULL,
    descricao VARCHAR(255) NOT NULL,
    criado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    versao BIGINT NOT NULL DEFAULT 0
);

INSERT INTO parametros_sistema (chave, valor, unidade, descricao)
VALUES
    ('PRECO_LUCRO_PERCENTUAL', 90.000000, 'percentual', 'Margem de lucro aplicada ao preço bruto por m²'),
    ('PRECO_DESCONTO_PERCENTUAL', 12.000000, 'percentual', 'Desconto aplicado depois da margem de lucro'),
    ('ARGAMASSA_PESO_SACO_KG', 20.000000, 'kg', 'Peso de uma embalagem de argamassa'),
    ('ARGAMASSA_COBERTURA_SACO_M2', 3.000000, 'm2', 'Cobertura padrão de uma embalagem de argamassa'),
    ('REJUNTE_PROFUNDIDADE_MM', 9.000000, 'mm', 'Profundidade padrão usada no cálculo de rejunte'),
    ('REJUNTE_COEFICIENTE', 1.800000, 'fator', 'Coeficiente padrão usado no cálculo de rejunte'),
    ('REJUNTE_PESO_EMBALAGEM_KG', 1.000000, 'kg', 'Peso padrão de uma embalagem de rejunte');
