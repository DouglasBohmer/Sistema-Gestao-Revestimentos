export const APP_ORIGIN = 'https://redeasso.assocom.workers.dev'
export const PORTAL_ORIGIN = 'https://redeasso.areacentral.com.br'
export const LOGIN_URL = `${PORTAL_ORIGIN}/401/?pg=associado_catalogos_produtos&ordenacao=nome-asc`
const COOKIE_NAMES = new Set(['PHPSESSID', 'cf_clearance', '__cf_bm'])

export function validGrant(grant, now = Date.now()) {
  const expiry = Date.parse(grant?.expiresAt)
  return /^[A-Za-z0-9_-]{43}$/.test(grant?.transferToken ?? '')
    && Number.isFinite(expiry) && expiry > now && expiry <= now + 10 * 60_000 + 5_000
}

export function senderAt(sender, origin) {
  try {
    return sender.frameId === 0 && Number.isInteger(sender.tab?.id)
      && new URL(sender.url).origin === origin && new URL(sender.tab.url).origin === origin
  } catch { return false }
}

// Cookies nunca são retornados ao content script ou à página React.
export function selectCookies(cookies, now = Date.now()) {
  const selected = cookies.filter(cookie => COOKIE_NAMES.has(cookie.name)
    && ['redeasso.areacentral.com.br', 'areacentral.com.br'].includes(cookie.domain.replace(/^\./, ''))
    && cookie.path === '/' && !cookie.partitionKey
    && (!cookie.expirationDate || cookie.expirationDate * 1000 > now))
  if (!selected.some(cookie => cookie.name === 'PHPSESSID')) throw new Error('SESSION_MISSING')
  if (new Set(selected.map(cookie => cookie.name)).size !== selected.length) throw new Error('AMBIGUOUS_SESSION')
  return selected.map(cookie => ({
    name: cookie.name, value: cookie.value, domain: cookie.domain, path: cookie.path,
    secure: cookie.secure, httpOnly: cookie.httpOnly, sameSite: cookie.sameSite,
    expiresAt: cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toISOString() : null,
  }))
}
