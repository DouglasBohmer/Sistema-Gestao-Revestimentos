import {
  APP_ORIGIN,
  PORTAL_ORIGIN,
  LOGIN_URL,
  validGrant,
  senderAt,
  selectCookies,
} from "./protocol.js";
import { readSelectedSession, saveSelectedSession } from "./shared-file.js";

const STORAGE_KEY = "redeasso.activeTransfer";
const ALARM = "redeasso.transferExpiry";
let receiving = false;
let starting = false;
let claimingSubmit = false;
let finishing = false;

async function activeTransfer() {
  const data = (await chrome.storage.session.get(STORAGE_KEY))[STORAGE_KEY];
  if (data && validGrant(data)) return data;
  if (data) await clearTransfer();
  return null;
}

async function clearTransfer() {
  await chrome.storage.session.remove(STORAGE_KEY);
  await chrome.alarms.clear(ALARM);
}

async function handle(message, sender) {
  if (senderAt(sender, APP_ORIGIN)) {
    if (message?.type === "PING") return { ok: true, version: 3 };
    if (message?.type === "OPEN_OPTIONS") {
      await chrome.runtime.openOptionsPage();
      return { ok: true };
    }
    if (message?.type === "START_FILE") {
      if (!validGrant(message.grant))
        return { ok: false, code: "INVALID_GRANT" };
      if (starting || receiving || claimingSubmit || finishing)
        return { ok: false, code: "BUSY" };
      starting = true;
      try {
        if (await activeTransfer()) return { ok: false, code: "BUSY" };
        let timeout;
        const cookies = await Promise.race([
          readSelectedSession(),
          new Promise((resolve) => {
            timeout = setTimeout(() => resolve(null), 3000);
          }),
        ]).finally(() => clearTimeout(timeout));
        if (!cookies) return { ok: false, code: "FILE_UNAVAILABLE" };
        const transfer = {
          ...message.grant,
          appTabId: sender.tab.id,
          appWindowId: sender.tab.windowId,
          portalTabId: null,
        };
        await chrome.storage.session.set({ [STORAGE_KEY]: transfer });
        await chrome.alarms.create(ALARM, {
          when: Date.parse(transfer.expiresAt),
        });
        try {
          const response = await submitCookies(transfer, cookies);
          const current = await activeTransfer();
          if (
            !response.ok ||
            current?.transferToken !== transfer.transferToken
          ) {
            await clearTransfer();
            return { ok: false, code: "FILE_REJECTED" };
          }
          transfer.validated = true;
          await chrome.storage.session.set({ [STORAGE_KEY]: transfer });
          return { ok: true, code: "FILE_RECEIVED" };
        } catch {
          await clearTransfer();
          return { ok: false, code: "FILE_REJECTED" };
        }
      } finally {
        starting = false;
      }
    }
    if (message?.type === "START") {
      if (!validGrant(message.grant))
        return { ok: false, code: "INVALID_GRANT" };
      // Uma transferência antiga em voo não pode apagar o pareamento de uma nova.
      if (starting || receiving || claimingSubmit || finishing)
        return { ok: false, code: "BUSY" };
      starting = true;
      try {
        if (await activeTransfer()) return { ok: false, code: "BUSY" };
        // Não reutilizar/inspecionar guias arbitrárias: só a guia aberta para esta tentativa.
        const tab = await chrome.tabs.create({ url: LOGIN_URL, active: true });
        await chrome.storage.session.set({
          [STORAGE_KEY]: {
            transferToken: message.grant.transferToken,
            expiresAt: message.grant.expiresAt,
            appTabId: sender.tab.id,
            appWindowId: sender.tab.windowId,
            portalTabId: tab.id,
          },
        });
        await chrome.alarms.create(ALARM, {
          when: Date.parse(message.grant.expiresAt),
        });
        return { ok: true };
      } finally {
        starting = false;
      }
    }
    const transfer = await activeTransfer();
    if (
      message?.type === "COMPLETE" &&
      transfer?.appTabId === sender.tab.id &&
      transfer.validated
    ) {
      if (finishing) return { ok: false, code: "BUSY" };
      finishing = true;
      try {
        // A SPA só sinaliza COMPLETE depois do POST protegido de conclusão no Spring.
        // Não usar IDs, URLs ou instruções de fechamento recebidos pela página.
        await chrome.tabs.update(transfer.appTabId, { active: true });
        if (Number.isInteger(transfer.appWindowId))
          await chrome.windows.update(transfer.appWindowId, { focused: true });
        try {
          if (!Number.isInteger(transfer.portalTabId))
            throw new Error("NO_PORTAL_TAB");
          const tab = await chrome.tabs.get(transfer.portalTabId);
          if (new URL(tab.url).origin === PORTAL_ORIGIN)
            await chrome.tabs.remove(transfer.portalTabId);
        } catch {
          /* Guia já fechada ou navegada pelo usuário: não tocar em outras guias. */
        }
        await clearTransfer();
        return { ok: true };
      } finally {
        finishing = false;
      }
    }
    if (message?.type === "CANCEL" && transfer?.appTabId === sender.tab.id) {
      await clearTransfer();
      // Deixar a guia real aberta: cancelar RedeASSO não faz logout no portal.
      return { ok: true };
    }
    if (message?.type === "FOCUS" && transfer?.appTabId === sender.tab.id) {
      await chrome.tabs.update(transfer.portalTabId, { active: true });
      return { ok: true };
    }
    return { ok: false, code: "NO_TRANSFER" };
  }

  if (
    !senderAt(sender, PORTAL_ORIGIN) ||
    !["PORTAL_STATE", "CLAIM_SUBMIT"].includes(message?.type)
  )
    return { ok: false };
  const transfer = await activeTransfer();
  if (!transfer || transfer.portalTabId !== sender.tab.id) return { ok: false };
  if (message.type === "CLAIM_SUBMIT") {
    if (transfer.autoSubmitted || claimingSubmit) return { ok: false };
    claimingSubmit = true;
    try {
      transfer.autoSubmitted = true;
      await chrome.storage.session.set({ [STORAGE_KEY]: transfer });
      return { ok: true, allowSubmit: true };
    } finally {
      claimingSubmit = false;
    }
  }
  if (!message.authenticated)
    return { ok: true, expiresAt: transfer.expiresAt };
  if (transfer.validated) return { ok: true, code: "RECEIVED" };
  if (receiving) return { ok: true, pending: true };
  receiving = true;
  try {
    const cookies = selectCookies(
      await chrome.cookies.getAll({ url: `${PORTAL_ORIGIN}/401/` }),
    );
    const response = await submitCookies(transfer, cookies);
    // Nunca encaminhar corpo/erro bruto nem o cookie jar para qualquer página.
    const current = await activeTransfer();
    if (response.ok && current?.transferToken === transfer.transferToken) {
      transfer.validated = true;
      await chrome.storage.session.set({ [STORAGE_KEY]: transfer });
      // Destino local escolhido explicitamente pelo usuário; nunca enviar cookies à SPA.
      let saveTimeout;
      await Promise.race([
        saveSelectedSession(cookies),
        new Promise((resolve) => {
          saveTimeout = setTimeout(() => resolve(false), 3000);
        }),
      ]).finally(() => clearTimeout(saveTimeout));
    } else {
      await clearTransfer();
    }
    await notify(
      transfer.appTabId,
      response.ok ? "RECEIVED" : "VALIDATION_FAILED",
    );
    return {
      ok: response.ok,
      code: response.ok ? "RECEIVED" : "VALIDATION_FAILED",
    };
  } catch {
    await clearTransfer();
    await notify(transfer.appTabId, "TRANSFER_FAILED");
    return { ok: false, code: "TRANSFER_FAILED" };
  } finally {
    receiving = false;
  }
}

function submitCookies(transfer, cookies) {
  return fetch(
    `${APP_ORIGIN}/api/auth/area-central/browser-transfers/receive`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(45000),
      body: JSON.stringify({ transferToken: transfer.transferToken, cookies }),
    },
  );
}

async function notify(tabId, code) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "TRANSFER_RESULT", code });
  } catch {
    /* A guia pode ter sido fechada; a concessão do servidor continua limitada. */
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message, sender)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false, code: "EXTENSION_ERROR" }));
  return true;
});
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM) void clearTransfer();
});
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const transfer = await activeTransfer();
  if (
    transfer &&
    (transfer.appTabId === tabId || transfer.portalTabId === tabId)
  )
    await clearTransfer();
});
chrome.action.onClicked.addListener(() =>
  chrome.tabs.create({ url: APP_ORIGIN }),
);
