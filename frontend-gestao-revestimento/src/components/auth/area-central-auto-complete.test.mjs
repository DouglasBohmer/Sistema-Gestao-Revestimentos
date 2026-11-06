import { test } from 'node:test'
import assert from 'node:assert/strict'
import { autoCompleteAreaCentral } from './area-central-auto-complete.ts'

test('conclusão automática só solicita fechamento após confirmação real do Spring', async () => {
  const actions = []
  await autoCompleteAreaCentral(async () => { actions.push('Spring'); return true }, async () => { actions.push('retornar e fechar') })
  assert.deepEqual(actions, ['Spring','retornar e fechar'])
})
test('recusa ou falha de conclusão não fecha a guia do portal', async () => {
  let closed = false
  for (const complete of [async()=>false, async()=>{throw new Error('falha fictícia') }]) {
    await assert.rejects(autoCompleteAreaCentral(complete, async()=>{ closed=true }))
  }
  assert.equal(closed,false)
})
test('falha de foco não desfaz autenticação já concluída', async () => {
  await assert.doesNotReject(autoCompleteAreaCentral(async()=>true, async()=>{throw new Error('guia fechada')}))
})
