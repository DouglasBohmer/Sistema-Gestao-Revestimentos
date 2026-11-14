import { selectCookies } from "./protocol.js";
const MAX_FILE = 65536,
  MAX_AGE = 12 * 60 * 60 * 1000;
const DB = "redeasso-file-selection";
export const FILE_ACTIVITY_KEY = "redeasso.fileActivity";

// Apenas diagnósticos locais de allowlist; nunca conteúdo, caminho ou erro bruto.
const FILE_MESSAGES = {
  FILE_READY: "Arquivo lido. A sessão ainda precisa ser aceita pelo servidor.",
  FILE_RECEIVED: "O servidor aceitou a sessão do arquivo.",
  FILE_REJECTED:
    "O servidor recusou a sessão do arquivo. Conecte novamente pelo RedeASSO.",
  FILE_NOT_CONFIGURED:
    "Nenhum arquivo configurado. Será usado login individual.",
  FILE_PERMISSION_REQUIRED:
    "Sem permissão para acessar o .txt. Clique em Renovar permissão e autorize leitura e escrita.",
  FILE_EMPTY:
    "O arquivo está vazio. Inicie Entrar com Área Central no RedeASSO para salvar uma sessão validada.",
  FILE_INVALID:
    "Arquivo inválido ou sessão vencida. Faça uma nova conexão pelo RedeASSO para atualizá-lo.",
  FILE_UNAVAILABLE:
    "Não foi possível acessar o arquivo. Confira a pasta de rede e selecione o .txt novamente.",
  FILE_SAVED: "Sessão salva no arquivo .txt com sucesso.",
  FILE_WRITE_FAILED:
    "Não foi possível gravar o .txt. Confira acesso à pasta, permissão de escrita e se o arquivo está bloqueado.",
  FILE_SAVE_PENDING:
    "A gravação do .txt ainda está em andamento. Aguarde a confirmação nesta página.",
};
export function fileMessage(code) {
  return FILE_MESSAGES[code] ?? "Nenhuma operação de arquivo registrada.";
}
export async function recordFileActivity(operation, code) {
  if (
    !["read", "write"].includes(operation) ||
    !Object.hasOwn(FILE_MESSAGES, code)
  )
    return;
  try {
    await chrome.storage.local.set({
      [`${FILE_ACTIVITY_KEY}.${operation}`]: {
        code,
        at: new Date().toISOString(),
      },
    });
  } catch {
    // Diagnóstico indisponível não altera autenticação nem gravação do arquivo.
  }
}

export async function selectedFile(value) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("handles");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("FILE_UNAVAILABLE"));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(
        "handles",
        value === undefined ? "readonly" : "readwrite",
      );
      const store = tx.objectStore("handles");
      const request =
        value === undefined
          ? store.get("session")
          : value === null
            ? store.delete("session")
            : store.put(value, "session");
      let result;
      request.onsuccess = () => {
        result = request.result;
      };
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(new Error("FILE_UNAVAILABLE"));
      tx.onabort = () => reject(new Error("FILE_UNAVAILABLE"));
    });
  } finally {
    db.close();
  }
}
export function parseSharedSession(text, now = Date.now()) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).length > MAX_FILE
  )
    throw new Error("INVALID_FILE");
  const last = text
    .trim()
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .at(-1)
    ?.trim();
  if (!last) throw new Error("INVALID_FILE");
  if (!last.startsWith("{")) {
    // Compatibilidade com o .txt legado, um PHPSESSID por linha. Somente o último.
    if (!/^[a-zA-Z0-9,-]{1,256}$/.test(last)) throw new Error("INVALID_FILE");
    return [
      {
        name: "PHPSESSID",
        value: last,
        domain: "redeasso.areacentral.com.br",
        path: "/",
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        expiresAt: null,
      },
    ];
  }
  const payload = JSON.parse(last),
    saved = Date.parse(payload.savedAt),
    expiry = Date.parse(payload.expiresAt);
  if (
    payload.format !== "redeasso-session-v1" ||
    !Number.isFinite(saved) ||
    saved > now + 5000 ||
    !Number.isFinite(expiry) ||
    expiry <= now ||
    expiry > saved + MAX_AGE ||
    !Array.isArray(payload.cookies) ||
    payload.cookies.length > 3
  )
    throw new Error("INVALID_FILE");
  const source = payload.cookies.map((cookie) => {
    if (
      typeof cookie.value !== "string" ||
      !cookie.value ||
      cookie.value.length > 4096 ||
      /[\s;,\x00-\x1f\x7f]/.test(cookie.value) ||
      typeof cookie.domain !== "string" ||
      typeof cookie.secure !== "boolean"
    )
      throw new Error("INVALID_FILE");
    const ownExpiry =
      cookie.expiresAt == null ? expiry : Date.parse(cookie.expiresAt);
    if (!Number.isFinite(ownExpiry)) throw new Error("INVALID_FILE");
    return { ...cookie, expirationDate: Math.min(expiry, ownExpiry) / 1000 };
  });
  return selectCookies(source, now);
}
export function serializeSharedSession(cookies, now = Date.now()) {
  const payload = {
    format: "redeasso-session-v1",
    savedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + MAX_AGE).toISOString(),
    cookies,
  };
  const allowed = parseSharedSession(JSON.stringify(payload), now);
  return JSON.stringify({ ...payload, cookies: allowed }) + "\n";
}
export async function readSelectedSession(load = selectedFile) {
  return (await readSelectedSessionResult(load)).cookies ?? null;
}
export async function readSelectedSessionResult(load = selectedFile) {
  try {
    const handle = await load();
    if (!handle) return { code: "FILE_NOT_CONFIGURED" };
    if ((await handle.queryPermission({ mode: "read" })) !== "granted")
      return { code: "FILE_PERMISSION_REQUIRED" };
    const file = await handle.getFile();
    if (file.size > MAX_FILE) return { code: "FILE_INVALID" };
    const text = await file.text();
    if (!text.trim()) return { code: "FILE_EMPTY" };
    try {
      return { code: "FILE_READY", cookies: parseSharedSession(text) };
    } catch {
      return { code: "FILE_INVALID" };
    }
  } catch {
    return { code: "FILE_UNAVAILABLE" };
  }
}
export async function saveSelectedSession(cookies, load = selectedFile) {
  return (await saveSelectedSessionResult(cookies, load)).code === "FILE_SAVED";
}
export async function saveSelectedSessionResult(cookies, load = selectedFile) {
  try {
    const handle = await load();
    if (!handle) return { code: "FILE_NOT_CONFIGURED" };
    if ((await handle.queryPermission({ mode: "readwrite" })) !== "granted")
      return { code: "FILE_PERMISSION_REQUIRED" };
    // Validar antes de abrir o stream: uma sessão inválida nunca toca no arquivo.
    const text = serializeSharedSession(cookies);
    const writable = await handle.createWritable();
    try {
      await writable.write(text);
      await writable.close();
    } catch {
      await writable.abort().catch(() => {});
      return { code: "FILE_WRITE_FAILED" };
    }
    return { code: "FILE_SAVED" };
  } catch {
    return { code: "FILE_WRITE_FAILED" };
  }
}
