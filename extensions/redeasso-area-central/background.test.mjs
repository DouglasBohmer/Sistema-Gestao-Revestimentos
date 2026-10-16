import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APP_ORIGIN, PORTAL_ORIGIN, LOGIN_URL } from './protocol.js'

test('background pareia guias e envia cookies só à API fixa, sem devolver à página', async () => {
  let listener, removed, alarmListener, stored = {}, cookieReads = 0
  const created = [], network = [], replies = []
  const chromeBefore = globalThis.chrome, fetchBefore = globalThis.fetch
  globalThis.chrome = {
    runtime: { onMessage: { addListener: fn => { listener = fn } } },
    storage: { session: {
      get: async key => ({ [key]: stored[key] }), set: async values => { Object.assign(stored, values) },
      remove: async key => { delete stored[key] },
    } },
    alarms: { create: async () => {}, clear: async () => {}, onAlarm: { addListener: fn => { alarmListener = fn } } },
    tabs: { create: async data => { created.push(data); return { id: 20 } }, update: async () => {}, sendMessage: async () => {},
      onRemoved: { addListener: fn => { removed = fn } } },
    action: { onClicked: { addListener: () => {} } },
    cookies: { getAll: async filter => {
      cookieReads++
      assert.deepEqual(filter, { url: `${PORTAL_ORIGIN}/401/` })
      return [{ name: 'PHPSESSID', value: 'cookie-ficticio-privado', domain: 'redeasso.areacentral.com.br',
        path: '/', secure: true, httpOnly: true }]
    } },
  }
  globalThis.fetch = async (url, options) => { network.push({ url, options }); return { ok: true } }
  try {
    await import(`./background.js?test=${Date.now()}`)
    const app = { frameId: 0, tab: { id: 10, url: APP_ORIGIN }, url: APP_ORIGIN }
    const portal = { frameId: 0, tab: { id: 20, url: LOGIN_URL }, url: LOGIN_URL }
    const send = (message, sender) => new Promise(resolve => listener(message, sender, reply => { replies.push(reply); resolve(reply) }))
    assert.equal((await send({ type: 'PING' }, app)).ok, true)
    assert.equal((await send({ type: 'PING' }, { ...app, url: 'https://outro.example' })).ok, false)
    assert.equal((await send({ type: 'PORTAL_STATE', authenticated: true }, portal)).ok, false)
    assert.equal(cookieReads, 0)
    const grant = { transferToken: 'a'.repeat(43), expiresAt: new Date(Date.now() + 60_000).toISOString() }
    assert.equal((await send({ type: 'START', grant }, app)).ok, true)
    assert.equal(created[0].url, LOGIN_URL)
    assert.equal(created[0].url.includes(grant.transferToken), false)
    assert.equal((await send({ type: 'START', grant }, app)).code, 'BUSY')
    assert.equal((await send({ type: 'PORTAL_STATE', authenticated: true }, { ...portal, tab: { ...portal.tab, id: 21 } })).ok, false)
    assert.equal(cookieReads, 0)
    const claims = await Promise.all([send({ type: 'CLAIM_SUBMIT' }, portal), send({ type: 'CLAIM_SUBMIT' }, portal)])
    assert.equal(claims.filter(reply => reply.allowSubmit).length, 1)
    assert.equal((await send({ type: 'PORTAL_STATE', authenticated: false }, portal)).ok, true)
    assert.equal(cookieReads, 0)
    assert.equal((await send({ type: 'PORTAL_STATE', authenticated: true }, portal)).code, 'RECEIVED')
    assert.equal(cookieReads, 1)
    assert.equal(network[0].url, `${APP_ORIGIN}/api/auth/area-central/browser-transfers/receive`)
    assert.equal(network[0].options.credentials, 'omit')
    assert.equal(network[0].options.redirect, 'error')
    assert.equal(JSON.parse(network[0].options.body).cookies[0].httpOnly, true)
    assert.equal(JSON.stringify(replies).includes('cookie-ficticio-privado'), false)
    assert.deepEqual(stored, {})
    assert.equal((await send({ type: 'PORTAL_STATE', authenticated: true }, portal)).ok, false)
    assert.equal(network.length, 1)
    await send({ type: 'START', grant }, app)
    await removed(10)
    assert.deepEqual(stored, {})
    await send({ type: 'START', grant }, app)
    await alarmListener({ name: 'redeasso.transferExpiry' })
    // Listener dispara limpeza assíncrona; aguardar a microtarefa da storage.
    await Promise.resolve()
    assert.deepEqual(stored, {})
    // Cancelar enquanto a API responde não permite iniciar um pareamento que
    // seria apagado acidentalmente pela transferência anterior.
    let release, entered
    const receiving = new Promise(resolve => { entered = resolve })
    globalThis.fetch = () => { entered(); return new Promise(resolve => { release = resolve }) }
    await send({ type: 'START', grant }, app)
    const inFlight = send({ type: 'PORTAL_STATE', authenticated: true }, portal)
    await receiving
    await send({ type: 'CANCEL' }, app)
    assert.equal((await send({ type: 'START', grant }, app)).code, 'BUSY')
    release({ ok: true })
    await inFlight
    assert.equal((await send({ type: 'START', grant }, app)).ok, true)
    await send({ type: 'CANCEL' }, app)
    assert.deepEqual(stored, {})
  } finally { globalThis.chrome = chromeBefore; globalThis.fetch = fetchBefore }
})
