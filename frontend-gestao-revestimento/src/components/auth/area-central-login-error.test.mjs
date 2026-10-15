import { test } from 'node:test'
import assert from 'node:assert/strict'
import { areaCentralLoginError } from './area-central-login-error.ts'

test('erro 502 em HTML mostra diagnóstico legível, sem conteúdo do proxy', () => {
  const message = areaCentralLoginError(502, '<!DOCTYPE html><html>detalhe-privado-ficticio</html>')
  assert.match(message, /HTTP 502/)
  assert.match(message, /comunicação com o serviço de login falhou/)
  assert.doesNotMatch(message, /DOCTYPE|html|detalhe-privado/)
})

test('503 estruturado preserva a orientação conhecida do Spring', () => {
  assert.equal(areaCentralLoginError(503, {
    code: 'AREA_CENTRAL_UNAVAILABLE', message: 'O navegador assistido não está disponível',
  }), 'HTTP 503: O navegador assistido não está disponível')
})

test('mensagem desconhecida ou HTML disfarçado não vai para a tela', () => {
  for (const data of [
    { code: 'AREA_CENTRAL_UNAVAILABLE', message: '<html>detalhe-ficticio</html>' },
    { code: 'DESCONHECIDO', message: 'detalhe-ficticio' },
    { code: 'AREA_CENTRAL_UNAVAILABLE', message: 'detalhe-ficticio'.repeat(100) },
  ]) {
    assert.doesNotMatch(areaCentralLoginError(503, data), /detalhe-ficticio|html/)
  }
})

test('erros de autenticação e sessão têm orientação sem expor corpo externo', () => {
  assert.match(areaCentralLoginError(401, 'conteudo-ficticio'), /Usuário ou senha inválidos/)
  assert.match(areaCentralLoginError(403, null), /sessão de segurança expirou/)
  assert.match(areaCentralLoginError(404, undefined), /inicie outra tentativa/)
})

test('timeout e resposta inesperada não reproduzem dados arbitrários', () => {
  assert.match(areaCentralLoginError(504, null), /HTTP 504/)
  assert.equal(areaCentralLoginError(500, 'corpo-ficticio'), 'HTTP 500: Não foi possível concluir a operação de login da Área Central.')
})
