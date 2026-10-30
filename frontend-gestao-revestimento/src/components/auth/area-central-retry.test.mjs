import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resetAreaCentralTransfer } from './area-central-retry.ts'

test('revoga concessão antiga no servidor antes de liberar pareamento da extensão', async () => {
  const steps = []
  await resetAreaCentralTransfer(
    async () => { steps.push('servidor') },
    async () => { steps.push('extensão'); return { ok: true } },
  )
  steps.push('nova concessão')
  assert.deepEqual(steps, ['servidor', 'extensão', 'nova concessão'])
})

test('extensão que já concluiu o envio não precisa manter pareamento antigo', async () => {
  await assert.doesNotReject(resetAreaCentralTransfer(async () => {}, async () => ({ ok: false, code: 'NO_TRANSFER' })))
})

test('falha na revogação do servidor interrompe reinício sem ignorar CSRF', async () => {
  let extensionCalled = false
  await assert.rejects(resetAreaCentralTransfer(
    async () => { throw new Error('CSRF inválido fictício') },
    async () => { extensionCalled = true; return { ok: true } },
  ))
  assert.equal(extensionCalled, false)
})

test('extensão indisponível interrompe a emissão de nova concessão', async () => {
  await assert.rejects(resetAreaCentralTransfer(async () => {}, async () => ({ ok: false, code: 'NOT_INSTALLED' })),
    /Não foi possível reiniciar/)
})
