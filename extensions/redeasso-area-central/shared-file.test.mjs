import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSharedSession,
  serializeSharedSession,
  readSelectedSession,
  saveSelectedSession,
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
    { ...original, cookies: [{ ...cookie, secure: false }] },
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
