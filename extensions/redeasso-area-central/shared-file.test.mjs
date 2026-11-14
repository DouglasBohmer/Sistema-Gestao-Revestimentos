import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSharedSession,
  serializeSharedSession,
  readSelectedSession,
  saveSelectedSession,
  readSelectedSessionResult,
  saveSelectedSessionResult,
  recordFileActivity,
  FILE_ACTIVITY_KEY,
} from "./shared-file.js";
const now = Date.now();
const cookie = {
  name: "PHPSESSID",
  value: "sessao-ficticia",
  domain: "redeasso.areacentral.com.br",
  path: "/",
  secure: true,
  httpOnly: true,
  sameSite: "lax",
  expiresAt: null,
};
test("txt versionado preserva apenas cookies permitidos, com expiração absoluta de 12 horas", () => {
  const text = serializeSharedSession(
    [cookie, { ...cookie, name: "analytics" }],
    now,
  );
  const result = parseSharedSession(text, now);
  assert.equal(text.includes("analytics"), false);
  assert.equal(result.length, 1);
  assert.equal(result[0].value, cookie.value);
  assert.equal(result[0].httpOnly, true);
  assert.equal(Date.parse(result[0].expiresAt), now + 12 * 3600000);
  assert.throws(() => parseSharedSession(text, now + 12 * 3600000));
});
test("sessão HTTPS válida sem atributo Secure também pode ser salva e relida", async () => {
  // O portal pode emitir PHPSESSID sem Secure; o Spring já aceita esse atributo.
  // O destino da transferência continua sendo HTTPS fixo, nunca definido pelo arquivo.
  const cookies = [{ ...cookie, secure: false, httpOnly: false }];
  let written;
  const handle = {
    queryPermission: async () => "granted",
    createWritable: async () => ({
      write: async (text) => {
        written = text;
      },
      close: async () => {},
    }),
    getFile: async () => ({ size: written.length, text: async () => written }),
  };
  assert.equal(await saveSelectedSession(cookies, async () => handle), true);
  const saved = await readSelectedSession(async () => handle);
  assert.equal(saved[0].secure, false);
  assert.equal(saved[0].httpOnly, false);
  assert.equal(saved[0].value, cookie.value);
});
test("legado usa somente última linha, nunca tenta cookie antigo ou aceita URL/comandos", () => {
  assert.equal(
    parseSharedSession("antigo\r\n\r\nsessao-mais-nova\r\n", now)[0].value,
    "sessao-mais-nova",
  );
  for (const text of [
    "",
    "a\n<script>",
    "https://exemplo.com",
    "PHPSESSID=segredo",
    "x".repeat(65537),
    "{invalido}",
  ])
    assert.throws(() => parseSharedSession(text, now));
});
test("recusa arquivo adulterado, longo, domínio errado, sessão ambígua e caracteres de cabeçalho", () => {
  const original = JSON.parse(serializeSharedSession([cookie], now));
  for (const payload of [
    { ...original, format: "outro" },
    { ...original, expiresAt: new Date(now + 13 * 3600000).toISOString() },
    { ...original, cookies: [{ ...cookie, domain: "outro.example" }] },
    { ...original, cookies: [cookie, cookie] },
    { ...original, cookies: [{ ...cookie, value: "a\r\nHeader: x" }] },
    { ...original, cookies: [{ ...cookie, secure: "false" }] },
    { ...original, cookies: [{ ...cookie, expiresAt: "inválido" }] },
  ])
    assert.throws(() => parseSharedSession(JSON.stringify(payload), now));
});
test("arquivo ausente, permissão revogada, rede inacessível ou conteúdo inválido liberam fallback", async () => {
  assert.equal(await readSelectedSession(async () => null), null);
  assert.equal(
    await readSelectedSession(async () => ({
      queryPermission: async () => "prompt",
    })),
    null,
  );
  assert.equal(
    await readSelectedSession(async () => {
      throw new Error("rede fora");
    }),
    null,
  );
  assert.equal(
    await readSelectedSession(async () => ({
      queryPermission: async () => "granted",
      getFile: async () => ({ size: 100000 }),
    })),
    null,
  );
});
test("salva apenas no handle autorizado e aborta escrita com falha, sem apagar seleção", async () => {
  let written,
    closed = false,
    aborted = false;
  const handle = {
    queryPermission: async () => "granted",
    createWritable: async () => ({
      write: async (text) => {
        written = text;
      },
      close: async () => {
        closed = true;
      },
      abort: async () => {
        aborted = true;
      },
    }),
  };
  assert.equal(await saveSelectedSession([cookie], async () => handle), true);
  assert.equal(closed, true);
  assert.equal(aborted, false);
  assert.equal(parseSharedSession(written)[0].value, cookie.value);
  assert.equal(
    await saveSelectedSession([cookie], async () => ({
      queryPermission: async () => "denied",
    })),
    false,
  );
  handle.createWritable = async () => ({
    write: async () => {
      throw new Error("somente leitura");
    },
    abort: async () => {
      aborted = true;
    },
  });
  assert.equal(await saveSelectedSession([cookie], async () => handle), false);
  assert.equal(aborted, true);
});

test("diagnóstico distingue arquivo vazio, inválido, ausente e permissão de escrita", async () => {
  assert.equal(
    (await readSelectedSessionResult(async () => null)).code,
    "FILE_NOT_CONFIGURED",
  );
  const handle = {
    queryPermission: async () => "granted",
    getFile: async () => ({ size: 0, text: async () => "" }),
  };
  assert.equal(
    (await readSelectedSessionResult(async () => handle)).code,
    "FILE_EMPTY",
  );
  handle.getFile = async () => ({ size: 10, text: async () => "{invalido}" });
  assert.equal(
    (await readSelectedSessionResult(async () => handle)).code,
    "FILE_INVALID",
  );
  handle.queryPermission = async () => "prompt";
  assert.equal(
    (await readSelectedSessionResult(async () => handle)).code,
    "FILE_PERMISSION_REQUIRED",
  );
  assert.equal(
    (await saveSelectedSessionResult([cookie], async () => handle)).code,
    "FILE_PERMISSION_REQUIRED",
  );
  assert.equal(
    (
      await readSelectedSessionResult(async () => {
        throw new Error("caminho privado");
      })
    ).code,
    "FILE_UNAVAILABLE",
  );
});

test("não estende expiração dos cookies nem abre arquivo se a sessão não é válida", async () => {
  const expiry = new Date(now + 30000).toISOString();
  const text = serializeSharedSession([{ ...cookie, expiresAt: expiry }], now);
  assert.equal(parseSharedSession(text, now)[0].expiresAt, expiry);
  assert.throws(() => parseSharedSession(text, now + 30001));
  let opened = false;
  const result = await saveSelectedSessionResult([], async () => ({
    queryPermission: async () => "granted",
    createWritable: async () => {
      opened = true;
    },
  }));
  assert.equal(result.code, "FILE_WRITE_FAILED");
  assert.equal(opened, false);
});

test("diagnóstico persistido usa apenas código e data, nunca conteúdo ou mensagem externa", async () => {
  const before = globalThis.chrome;
  const activity = {};
  globalThis.chrome = {
    storage: {
      local: { set: async (value) => Object.assign(activity, value) },
    },
  };
  try {
    await recordFileActivity("write", "FILE_SAVED");
    await recordFileActivity("read", "cookie-ou-caminho-privado");
    await recordFileActivity("outro", "FILE_SAVED");
    assert.deepEqual(Object.keys(activity), [`${FILE_ACTIVITY_KEY}.write`]);
    assert.deepEqual(Object.keys(activity[`${FILE_ACTIVITY_KEY}.write`]), [
      "code",
      "at",
    ]);
    assert.equal(activity[`${FILE_ACTIVITY_KEY}.write`].code, "FILE_SAVED");
    assert.ok(
      Number.isFinite(Date.parse(activity[`${FILE_ACTIVITY_KEY}.write`].at)),
    );
  } finally {
    globalThis.chrome = before;
  }
});
