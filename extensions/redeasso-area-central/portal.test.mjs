import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./portal.js', import.meta.url), 'utf8')
function page({ approved = true, autofill = true, disabled = false, authenticated = false } = {}) {
  let tick, clicked = 0, claims = 0, received = 0, cleared = false
  const field = { matches: selector => { assert.equal(selector, ':autofill'); return autofill } }
  Object.defineProperty(field, 'value', { get() { throw new Error('A extensão não pode ler credenciais') } })
  const button = { disabled, click() { clicked++ } }
  const form = { checkValidity: () => true }
  const notice = []
  const window = {}; window.top = window
  vm.runInNewContext(source, {
    window, location: { origin: 'https://redeasso.areacentral.com.br' },
    document: {
      readyState: 'complete',
      querySelector(selector) {
        if (selector === '#form-login, input[type="password"]') return authenticated ? null : form
        if (selector === '#form-login') return authenticated ? null : form
        if (selector === '#USR_APELIDO' || selector === '#USR_SENHA') return field
        if (selector === '#btn-entrar') return button
        if (selector === '[name="cf-turnstile-response"]') return { value: approved ? 'resposta-ficticia-aprovada-pelo-portal' : '' }
        return authenticated ? {} : null
      },
      createElement: () => ({ style: {} }), body: { append: element => notice.push(element.textContent) },
    },
    chrome: { runtime: { async sendMessage(message) {
      if (message.type === 'CLAIM_SUBMIT') return { ok: true, allowSubmit: ++claims === 1 }
      if (message.authenticated) received++
      return { ok: true, code: message.authenticated ? 'RECEIVED' : undefined }
    } } },
    setInterval: callback => { tick = callback; return 1 }, clearInterval: () => { cleared = true }, setTimeout: () => {},
  })
  return { tick: () => tick(), result: () => ({ clicked, claims, received, cleared, notice }) }
}
test('autofill permite envio único somente após aprovação legítima, sem ler credenciais', async () => {
  const portal = page()
  await portal.tick(); await portal.tick()
  assert.equal(portal.result().clicked, 1)
})
test('não clica CAPTCHA, não envia com botão bloqueado e não lê campos manuais', async () => {
  for (const options of [{ approved: false }, { disabled: true }, { autofill: false }]) {
    const portal = page(options)
    await portal.tick()
    assert.equal(portal.result().clicked, 0)
    assert.equal(portal.result().claims, 0)
  }
})
test('catálogo autenticado envia apenas sinal e mostra orientação para concluir', async () => {
  const portal = page({ authenticated: true })
  await portal.tick()
  assert.equal(portal.result().received, 1)
  assert.equal(portal.result().cleared, true)
  assert.match(portal.result().notice[0], /Concluir e entrar/)
})
