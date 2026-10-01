DO $redeasso$
DECLARE
    v_piso_id BIGINT;
    v_piso_nome VARCHAR(200);
    v_total INTEGER;
    v_link_paginacao CONSTANT VARCHAR(2048) :=
        'https://grupoembramaco.com.br/public/images/product/bc7df15dec999e399610432b2496f3c2.jpg';
BEGIN
    LOCK TABLE pisos IN SHARE ROW EXCLUSIVE MODE;

    SELECT COUNT(*), MIN(id)
      INTO v_total, v_piso_id
      FROM pisos
     WHERE BTRIM(codigo_rede) = '2183343';

    IF v_total <> 1 THEN
        RAISE EXCEPTION
            'Esperado exatamente 1 piso com código ASSO 2183343; encontrados %',
            v_total;
    END IF;

    SELECT nome
      INTO v_piso_nome
      FROM pisos
     WHERE id = v_piso_id
       FOR UPDATE;

    UPDATE pisos
       SET link_paginacao = v_link_paginacao,
           atualizado_em = CURRENT_TIMESTAMP,
           versao = versao + 1
     WHERE id = v_piso_id
       AND link_paginacao IS DISTINCT FROM v_link_paginacao;

    IF FOUND THEN
        INSERT INTO atividades (tipo, descricao, piso_nome, criado_em)
        VALUES (
            'cadastro',
            'Paginação/Ambiente do piso ' || v_piso_nome || ' atualizada',
            v_piso_nome,
            CURRENT_TIMESTAMP
        );
    END IF;
END
$redeasso$;
