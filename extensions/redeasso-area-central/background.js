import { APP_ORIGIN, PORTAL_ORIGIN, LOGIN_URL, validGrant, senderAt, selectCookies } from './protocol.js'

const STORAGE_KEY = 'redeasso.activeTransfer'
const ALARM = 'redeasso.transferExpiry'
let receiving = false
let starting = false
let claimingSubmit = false

async function activeTransfer() {
  const data = (await chrome.storage.session.get(STORAGE_KEY))[STORAGE_KEY]
  if (data && validGrant(data)) return data
  if (data) await clearTransfer()
  return null
}

async function clearTransfer() {
  await chrome.storage.session.remove(STORAGE_KEY)
  await chrome.alarms.clear(ALARM)
}

async function handle(message, sender) {
  if (senderAt(sender, APP_ORIGIN)) {
    if (message?.type === 'PING') return { ok: true, version: 1 }
    if (message?.type === 'START') {
      if (!validGrant(message.grant)) return { ok: false, code: 'INVALID_GRANT' }
      // Uma transferência antiga em voo não pode apagar o pareamento de uma nova.
      if (starting || receiving || claimingSubmit) return { ok: false, code: 'BUSY' }
      starting = true
      try {
        if (await activeTransfer()) return { ok: false, code: 'BUSY' }
        // Não reutilizar/inspecionar guias arbitrárias: só a guia aberta para esta tentativa.
        const tab = await chrome.tabs.create({ url: LOGIN_URL, active: true })
        await chrome.storage.session.set({ [STORAGE_KEY]: {
          transferToken: message.grant.transferToken, expiresAt: message.grant.expiresAt,
          appTabId: sender.tab.id, portalTabId: tab.id,
        } })
        await chrome.alarms.create(ALARM, { when: Date.parse(message.grant.expiresAt) })
        return { ok: true }
      } finally { starting = false }
    }
    const transfer = await activeTransfer()
    if (message?.type === 'CANCEL' && transfer?.appTabId === sender.tab.id) {
      await clearTransfer()
      // Deixar a guia real aberta: cancelar RedeASSO não faz logout no portal.
      return { ok: true }
    }
    if (message?.type === 'FOCUS' && transfer?.appTabId === sender.tab.id) {
      await chrome.tabs.update(transfer.portalTabId, { active: true })
      return { ok: true }
    }
    return { ok: false, code: 'NO_TRANSFER' }
  }

  if (!senderAt(sender, PORTAL_ORIGIN) || !['PORTAL_STATE', 'CLAIM_SUBMIT'].includes(message?.type)) return { ok: false }
  const transfer = await activeTransfer()
  if (!transfer || transfer.portalTabId !== sender.tab.id) return { ok: false }
  if (message.type === 'CLAIM_SUBMIT') {
    if (transfer.autoSubmitted || claimingSubmit) return { ok: false }
    claimingSubmit = true
    try {
      transfer.autoSubmitted = true
      await chrome.storage.session.set({ [STORAGE_KEY]: transfer })
      return { ok: true, allowSubmit: true }
    } finally { claimingSubmit = false }
  }
  if (!message.authenticated) return { ok: true, expiresAt: transfer.expiresAt }
  if (receiving) return { ok: true, pending: true }
  receiving = true
  try {
    const cookies = selectCookies(await chrome.cookies.getAll({ url: `${PORTAL_ORIGIN}/401/` }))
    const response = await fetch(`${APP_ORIGIN}/api/auth/area-central/browser-transfers/receive`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'omit', cache: 'no-store', redirect: 'error',
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({ transferToken: transfer.transferToken, cookies }),
    })
    // Nunca encaminhar corpo/erro bruto nem o cookie jar para qualquer página.
    await clearTransfer()
    await notify(transfer.appTabId, response.ok ? 'RECEIVED' : 'VALIDATION_FAILED')
    return { ok: response.ok, code: response.ok ? 'RECEIVED' : 'VALIDATION_FAILED' }
  } catch {
    await clearTransfer()
    await notify(transfer.appTabId, 'TRANSFER_FAILED')
    return { ok: false, code: 'TRANSFER_FAILED' }
  } finally { receiving = false }
}

async function notify(tabId, code) {
  try { await chrome.tabs.sendMessage(tabId, { type: 'TRANSFER_RESULT', code }) }
  catch { /* A guia pode ter sido fechada; a concessão do servidor continua limitada. */ }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message, sender).then(sendResponse).catch(() => sendResponse({ ok: false, code: 'EXTENSION_ERROR' }))
  return true
})
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === ALARM) void clearTransfer() })
chrome.tabs.onRemoved.addListener(async tabId => {
  const transfer = await activeTransfer()
  if (transfer && (transfer.appTabId === tabId || transfer.portalTabId === tabId)) await clearTransfer()
})
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: APP_ORIGIN }))
