import { selectCookies } from "./protocol.js";
const MAX_FILE = 65536,
  MAX_AGE = 12 * 60 * 60 * 1000;
const DB = "redeasso-file-selection";

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
      cookie.secure !== true
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
  try {
    const handle = await load();
    if (
      !handle ||
      (await handle.queryPermission({ mode: "read" })) !== "granted"
    )
      return null;
    const file = await handle.getFile();
    if (file.size > MAX_FILE) return null;
    return parseSharedSession(await file.text());
  } catch {
    return null;
  }
}
export async function saveSelectedSession(cookies, load = selectedFile) {
  try {
    const handle = await load();
    if (
      !handle ||
      (await handle.queryPermission({ mode: "readwrite" })) !== "granted"
    )
      return false;
    const writable = await handle.createWritable();
    try {
      await writable.write(serializeSharedSession(cookies));
      await writable.close();
    } catch {
      await writable.abort().catch(() => {});
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
