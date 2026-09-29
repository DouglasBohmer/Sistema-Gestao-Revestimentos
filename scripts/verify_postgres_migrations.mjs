import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const migrationDirectory = join(
  repositoryRoot,
  "backend-gestao-revestimento",
  "src",
  "main",
  "resources",
  "db",
  "migration",
);

const migrationVersion = (filename) =>
  Number.parseInt(filename.match(/^V(\d+)__/)?.[1] ?? "-1", 10);

async function scalar(database, sql) {
  const result = await database.query(sql);
  return result.rows[0].value;
}

async function expectConstraintViolation(
  database,
  sql,
  expectedCode,
  description,
) {
  try {
    await database.exec(sql);
    assert.fail(`A restrição não rejeitou: ${description}`);
  } catch (error) {
    if (error instanceof assert.AssertionError) {
      throw error;
    }
    assert.equal(
      error.code,
      expectedCode,
      `Falha inesperada ao validar a restrição: ${description}`,
    );
  }
}

const database = await PGlite.create({ dataDir: "memory://" });

try {
  const migrations = (await readdir(migrationDirectory))
    .filter((filename) => /^V\d+__.*\.sql$/.test(filename))
    .sort((left, right) => migrationVersion(left) - migrationVersion(right));

  assert.deepEqual(
    migrations.map(migrationVersion),
    [1, 2, 3, 4, 5, 6, 7],
    "A sequência de migrations deve ser contínua de V1 a V7",
  );

  for (const migration of migrations) {
    const sql = await readFile(join(migrationDirectory, migration), "utf8");
    await database.exec(sql);
    console.log(`✓ ${migration}`);
  }

  assert.equal(
    Number(
      await scalar(database, "SELECT COUNT(*)::integer AS value FROM pisos"),
    ),
    261,
    "A carga consolidada deve conter 261 produtos",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        "SELECT SUM(jsonb_array_length(dados_legado -> 'fontes'))::integer AS value FROM pisos",
      ),
    ),
    264,
    "Os 264 registros de origem devem permanecer rastreáveis em dados_legado",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        `SELECT COUNT(*)::integer AS value
           FROM pisos
          WHERE NULLIF(BTRIM(codigo_rede), '') IS NULL
            AND NULLIF(BTRIM(codigo_loja), '') IS NULL`,
      ),
    ),
    0,
    "Todo produto deve possuir ASSO ou CTC",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        `SELECT COUNT(*)::integer AS value
           FROM (
             SELECT LOWER(BTRIM(nome))
               FROM pisos
              GROUP BY LOWER(BTRIM(nome))
             HAVING COUNT(*) > 1
           ) nomes_duplicados`,
      ),
    ),
    0,
    "Não pode haver nomes duplicados ignorando caixa e espaços externos",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        `SELECT COUNT(*)::integer AS value
           FROM pisos
          WHERE classificacao_uso IS NOT NULL
            AND classificacao_uso NOT IN ('LA', 'LB', 'LC', 'LD', 'LE', 'LF')`,
      ),
    ),
    0,
    "Todas as classificações devem estar entre LA e LF",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        "SELECT COUNT(*)::integer AS value FROM pisos WHERE acabamento_bordas NOT IN ('RETIFICADO', 'BOLD')",
      ),
    ),
    0,
    "Todo acabamento deve ser RETIFICADO ou BOLD",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        `SELECT COUNT(*)::integer AS value
           FROM pisos
          WHERE ativo IS DISTINCT FROM FALSE
             OR valor <> 0
             OR estoque_m2 <> 0
             OR origem_valor <> 'NAO_INFORMADO'
             OR origem_estoque <> 'NAO_INFORMADO'`,
      ),
    ),
    0,
    "Produtos importados devem iniciar inativos, zerados e sem origem informada",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        `SELECT COUNT(*)::integer AS value
           FROM pisos
          WHERE link_foto LIKE '/product-images/legacy/%'`,
      ),
    ),
    131,
    "Somente os 131 produtos com imagens válidas devem apontar para o R2",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        "SELECT COUNT(*)::integer AS value FROM pisos WHERE link_foto IS NOT NULL",
      ),
    ),
    259,
    "A origem possui 259 links de foto e dois produtos sem foto",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        `SELECT COUNT(*)::integer AS value
           FROM pisos
          WHERE link_foto_origem IS NOT NULL`,
      ),
    ),
    259,
    "A URL original deve permanecer preservada inclusive após o roteamento ao R2",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        `SELECT COUNT(*)::integer AS value
           FROM pisos
          WHERE link_foto IS NOT NULL
            AND link_foto NOT LIKE '/product-images/legacy/%'`,
      ),
    ),
    128,
    "Os 128 produtos sem imagem válida no momento da análise devem manter o link atual",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        "SELECT COUNT(*)::integer AS value FROM pisos WHERE codigo_rede IS NULL",
      ),
    ),
    13,
    "Treze produtos dependem apenas do código CTC",
  );

  const classifications = await database.query(`
    SELECT classificacao_uso, COUNT(*)::integer AS quantidade
      FROM pisos
     GROUP BY classificacao_uso
     ORDER BY classificacao_uso NULLS LAST
  `);
  assert.deepEqual(classifications.rows, [
    { classificacao_uso: "LA", quantidade: 52 },
    { classificacao_uso: "LB", quantidade: 26 },
    { classificacao_uso: "LC", quantidade: 89 },
    { classificacao_uso: "LD", quantidade: 44 },
    { classificacao_uso: "LE", quantidade: 36 },
    { classificacao_uso: "LF", quantidade: 9 },
    { classificacao_uso: null, quantidade: 5 },
  ]);

  const finishes = await database.query(`
    SELECT acabamento_bordas, COUNT(*)::integer AS quantidade
      FROM pisos
     GROUP BY acabamento_bordas
     ORDER BY acabamento_bordas
  `);
  assert.deepEqual(finishes.rows, [
    { acabamento_bordas: "BOLD", quantidade: 73 },
    { acabamento_bordas: "RETIFICADO", quantidade: 188 },
  ]);

  assert.equal(
    Number(
      await scalar(
        database,
        "SELECT COUNT(*)::integer AS value FROM pisos WHERE codigo_rede = '2178116' AND altura = 57.5 AND classificacao_uso = 'LF'",
      ),
    ),
    1,
    "O produto ASSO 2178116 deve refletir a consolidação aprovada",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        "SELECT COUNT(*)::integer AS value FROM pisos WHERE codigo_rede = '2181381'",
      ),
    ),
    1,
    "O código ASSO 2181381 deve ter sido consolidado",
  );
  assert.equal(
    Number(
      await scalar(
        database,
        "SELECT COUNT(*)::integer AS value FROM pisos WHERE codigo_loja = '6877'",
      ),
    ),
    1,
    "O código CTC 6877 deve ter sido consolidado",
  );

  await expectConstraintViolation(
    database,
    `INSERT INTO pisos (
       nome, largura, altura, rejunte, pecas_por_caixa, m2_por_caixa,
       acabamento_bordas, valor, estoque_m2, ativo, origem_valor, origem_estoque
     ) VALUES (
       'SEM CÓDIGO', 1, 1, 0, 1, 1, 'BOLD', 0, 0, FALSE, 'NAO_INFORMADO', 'NAO_INFORMADO'
    )`,
    "23514",
    "produto sem ASSO e sem CTC",
  );
  await expectConstraintViolation(
    database,
    `INSERT INTO pisos (
       nome, codigo_rede, largura, altura, rejunte, pecas_por_caixa, m2_por_caixa,
       acabamento_bordas, valor, estoque_m2, ativo, origem_valor, origem_estoque
     ) VALUES (
       '  piso almeida 42x83 leiria natural br  ', 'TESTE', 1, 1, 0, 1, 1,
       'BOLD', 0, 0, FALSE, 'NAO_INFORMADO', 'NAO_INFORMADO'
    )`,
    "23505",
    "nome duplicado ignorando caixa e espaços externos",
  );

  await database.exec(`
    INSERT INTO pisos (
      nome, codigo_rede, largura, altura, rejunte, pecas_por_caixa, m2_por_caixa,
      acabamento_bordas, valor, estoque_m2, ativo, origem_valor, origem_estoque
    ) VALUES
      ('DUPLICADO CONTROLADO A', 'CODIGO-DUPLICADO', 1, 1, 0, 1, 1, 'BOLD', 0, 0, FALSE, 'NAO_INFORMADO', 'NAO_INFORMADO'),
      ('DUPLICADO CONTROLADO B', 'CODIGO-DUPLICADO', 1, 1, 0, 1, 1, 'BOLD', 0, 0, FALSE, 'NAO_INFORMADO', 'NAO_INFORMADO');
  `);
  assert.equal(
    Number(
      await scalar(
        database,
        "SELECT COUNT(*)::integer AS value FROM pisos WHERE codigo_rede = 'CODIGO-DUPLICADO'",
      ),
    ),
    2,
    "Códigos repetidos devem continuar permitidos para seleção explícita na interface",
  );

  console.log(
    "\nVerificação concluída: V1–V7 aplicadas, 261 produtos e 131 imagens válidas direcionadas ao R2.",
  );
} finally {
  await database.close();
}
