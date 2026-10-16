import { test } from 'node:test'
import assert from 'node:assert/strict'
import { areaCentralExtension } from './area-central-extension.ts'

test('ponte ignora origem, janela e ID incorretos e limpa listeners ao receber resposta', async () => {
  const previous = globalThis.window
  let listener, sent, cancelled = false
  const fakeWindow = {
    location: { origin: 'https://redeasso.assocom.workers.dev' },
    addEventListener: (_, fn) => { listener = fn }, removeEventListener: () => { listener = null },
    setTimeout: () => 1, clearTimeout: () => { cancelled = true },
    postMessage: (message, origin) => { sent = { message, origin } },
  }
  globalThis.window = fakeWindow
  try {
    const pending = areaCentralExtension('PING')
    const data = { source: 'redeasso-extension', id: sent.message.id, ok: true, version: 1 }
    listener({ source: {}, origin: sent.origin, data })
    listener({ source: fakeWindow, origin: 'https://outro.example', data })
    listener({ source: fakeWindow, origin: sent.origin, data: { ...data, id: 'outro' } })
    assert.equal(cancelled, false)
    listener({ source: fakeWindow, origin: sent.origin, data })
    assert.equal((await pending).ok, true)
    assert.equal(listener, null)
    assert.equal(cancelled, true)
    assert.equal(sent.message.type, 'PING')
    assert.equal(JSON.stringify(sent).includes('cookies'), false)
  } finally { globalThis.window = previous }
})

test('extensão ausente resolve com diagnóstico e remove listener, sem chamar APIs de negócio', async () => {
  const previous = globalThis.window
  let timeout, removed = false
  globalThis.window = {
    location: { origin: 'https://redeasso.assocom.workers.dev' },
    addEventListener: () => {}, removeEventListener: () => { removed = true },
    setTimeout: callback => { timeout = callback; return 1 }, clearTimeout: () => {}, postMessage: () => {},
  }
  try {
    const pending = areaCentralExtension('PING')
    timeout()
    assert.deepEqual(await pending, { ok: false, code: 'NOT_INSTALLED' })
    assert.equal(removed, true)
  } finally { globalThis.window = previous }
})
