import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';

const script = readFileSync(new URL('./portal-login.js', import.meta.url), 'utf8');
function portal({ disabled = true, token = '', origin = 'https://redeasso.areacentral.com.br' } = {}) {
  let tick;
  let clicks = 0;
  let cleared = false;
  class Input {
    get value() { return this.current; }
    set value(value) { this.current = value; }
    dispatchEvent() {}
  }
  const username = new Input();
  const password = new Input();
  const form = { isConnected: true, dataset: {} };
  const button = { disabled, click() { clicks++; } };
  const response = { value: token };
  const fields = { '#form-login': form, '#USR_APELIDO': username, '#USR_SENHA': password,
    '#btn-entrar': button, '.cf-turnstile': {}, '[name="cf-turnstile-response"]': response };
  const context = { location: { origin }, document: { querySelector(selector) { return fields[selector]; } },
    HTMLInputElement: Input, Event: class {}, Date,
    setInterval(callback) { tick = callback; return 1; }, clearInterval() { cleared = true; } };
  const fill = runInNewContext('(' + script + ')', context);
  return { fill, button, response, form, username, password, tick() { if (!cleared && tick) tick(); }, clicks() { return clicks; } };
}
const credentials = () => ({ origin: 'https://redeasso.areacentral.com.br', username: 'usuario-teste', password: 'senha-teste' });

test('preenche campos reais sem clicar enquanto o portal bloqueia o envio', () => {
  const page = portal();
  const data = credentials();
  assert.equal(page.fill(data), true);
  assert.equal(page.username.value, 'usuario-teste');
  assert.equal(page.password.value, 'senha-teste');
  assert.equal(data.password, null);
  page.tick();
  assert.equal(page.clicks(), 0);
});
test('envia uma única vez após botão e token liberados pelo portal', () => {
  const page = portal();
  page.fill(credentials());
  page.button.disabled = false;
  page.response.value = 'token-simulado-produzido-pelo-portal';
  page.tick(); page.tick();
  assert.equal(page.clicks(), 1);
});
test('botão habilitado sem resposta Turnstile não permite envio automático', () => {
  const page = portal({ disabled: false });
  page.fill(credentials()); page.tick();
  assert.equal(page.clicks(), 0);
});
test('redirecionamento para outra origem não recebe senha nem clique', () => {
  const page = portal({ origin: 'https://outro.example' });
  assert.equal(page.fill(credentials()), false);
  assert.equal(page.password.value, undefined);
  assert.equal(page.clicks(), 0);
});
test('cancelar/navegar interrompe o envio pendente', () => {
  const page = portal({ disabled: false, token: 'token-simulado' });
  page.fill(credentials()); page.form.isConnected = false; page.tick();
  assert.equal(page.clicks(), 0);
});
