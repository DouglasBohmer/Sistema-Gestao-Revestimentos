import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openAreaCentralLoginTab } from './area-central-login-tab.ts'

function element(tag) {
  return {
    tag, style: {}, textContent: '', children: [], attributes: {},
    append(...nodes) { this.children.push(...nodes) },
    replaceChildren(...nodes) { this.children = nodes },
    setAttribute(name, value) { this.attributes[name] = value },
  }
}

function fixture() {
  const navigations = []
  const document = { documentElement: {}, head: element('head'), body: element('body'), createElement: element }
  const window = {
    opener: { privateOrigin: true }, document, closed: false, focused: false,
    location: { replace(url) { navigations.push(url) } },
    focus() { this.focused = true }, close() { this.closed = true },
  }
  return { window, document, navigations }
}

test('abre imediatamente e isola a nova guia da origem', () => {
  const { window, document } = fixture()
  let opened = false
  const tab = openAreaCentralLoginTab(() => { opened = true; return window })
  assert.equal(opened, true)
  assert.ok(tab)
  assert.equal(window.opener, null)
  assert.equal(document.documentElement.lang, 'pt-BR')
  assert.ok(document.head.children.some(node => node.name === 'referrer' && node.content === 'no-referrer'))
  assert.match(document.body.children[0].children[0].textContent, /Abrindo o login/)
})

test('detecta bloqueio da nova guia antes de iniciar operações assíncronas', () => {
  assert.equal(openAreaCentralLoginTab(() => null), null)
  assert.equal(openAreaCentralLoginTab(() => { throw new Error('bloqueada') }), null)
})

test('navega para o viewer protegido sem iframe nem leitura de cookies externos', () => {
  const { window, navigations } = fixture()
  const tab = openAreaCentralLoginTab(() => window)
  const viewer = 'https://api.example/vnc.html?path=websockify%3Ftoken%3Dfixture'
  assert.equal(tab.navigate(viewer), true)
  assert.deepEqual(navigations, [viewer])
  tab.focus()
  assert.equal(window.focused, true)
})

test('mensagens de falha usam texto, sem interpolar HTML', () => {
  const { window, document } = fixture()
  const tab = openAreaCentralLoginTab(() => window)
  tab.showError('HTTP 503: <html>erro-ficticio</html>')
  const message = document.body.children[0].children[1]
  assert.equal(message.textContent, 'HTTP 503: <html>erro-ficticio</html>')
  assert.equal(message.attributes.role, 'alert')
  assert.equal(tab.isOpen(), true)
})

test('não tenta modificar o documento externo depois de navegar', () => {
  const { window, document } = fixture()
  const tab = openAreaCentralLoginTab(() => window)
  const originalTitle = document.title
  tab.navigate('https://api.example/vnc.html')
  Object.defineProperty(window, 'document', { get() { throw new Error('cross-origin') } })
  assert.doesNotThrow(() => tab.showError('erro posterior'))
  assert.equal(document.title, originalTitle)
})

test('rejeita URLs executáveis, credenciais na URL e HTTP externo', () => {
  const { window, navigations } = fixture()
  const tab = openAreaCentralLoginTab(() => window)
  for (const url of ['javascript:alert(1)', 'data:text/html,teste', 'https://usuario:senha@api.example', 'http://api.example', 'invalida']) {
    assert.equal(tab.navigate(url), false)
  }
  assert.deepEqual(navigations, [])
  assert.equal(tab.navigate('http://localhost:7900/vnc.html'), true)
})

test('permite fechar somente a guia aberta e não navega se ela já foi fechada', () => {
  const { window, navigations } = fixture()
  const tab = openAreaCentralLoginTab(() => window)
  tab.close()
  assert.equal(tab.isOpen(), false)
  assert.equal(tab.navigate('https://api.example/vnc.html'), false)
  assert.deepEqual(navigations, [])
})
