import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { validGrant, senderAt, selectCookies, APP_ORIGIN, PORTAL_ORIGIN } from './protocol.js'

const now = Date.now()
const grant = { transferToken: 'a'.repeat(43), expiresAt: new Date(now + 60_000).toISOString() }
const cookie = { name: 'PHPSESSID', value: 'ficticio', domain: 'redeasso.areacentral.com.br', path: '/', secure: true, httpOnly: true }
test('concessão curta válida; recusa concessão malformada, expirada ou longa', () => {
  assert.equal(validGrant(grant, now), true)
  for (const input of [{}, { ...grant, transferToken: 'curto' }, { ...grant, expiresAt: new Date(now).toISOString() },
    { ...grant, expiresAt: new Date(now + 12 * 3600_000).toISOString() }]) assert.equal(validGrant(input, now), false)
})
test('sender deve ser guia superior das origens HTTPS exatas', () => {
  assert.equal(senderAt({ frameId: 0, tab: { id: 1, url: APP_ORIGIN }, url: APP_ORIGIN }, APP_ORIGIN), true)
  for (const sender of [{}, { frameId: 1, tab: { id: 1, url: APP_ORIGIN }, url: APP_ORIGIN },
    { frameId: 0, tab: { id: 1, url: APP_ORIGIN }, url: 'https://outro.example' },
    { frameId: 0, tab: { id: 1, url: `${APP_ORIGIN}.outro.example` }, url: `${APP_ORIGIN}.outro.example` }]) {
    assert.equal(senderAt(sender, APP_ORIGIN), false)
  }
})
test('seleciona só cookies necessários válidos do portal, preservando HttpOnly', () => {
  const selected = selectCookies([cookie, { ...cookie, name: 'analytics' }, { ...cookie, name: '__cf_bm', domain: 'outro.example' },
    { ...cookie, name: '__cf_bm', expirationDate: now / 1000 - 1 }, { ...cookie, name: '__cf_bm', partitionKey: {} }], now)
  assert.deepEqual(selected.map(value => value.name), ['PHPSESSID'])
  assert.equal(selected[0].httpOnly, true)
  assert.equal(selected[0].expiresAt, null)
  assert.throws(() => selectCookies([]))
  assert.throws(() => selectCookies([cookie, cookie]))
})
test('manifest não pede acesso global, depuração, senha ou API cookies em outras origens', async () => {
  const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url)))
  assert.equal(manifest.manifest_version, 3)
  assert.deepEqual(manifest.host_permissions, [`${PORTAL_ORIGIN}/*`, `${APP_ORIGIN}/*`])
  assert.deepEqual(manifest.permissions, ['cookies', 'storage', 'alarms'])
  assert.equal(manifest.externally_connectable, undefined)
})
