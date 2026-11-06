import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAreaCentralRefreshQueue } from './area-central-refresh-queue.ts'
const flush = () => new Promise(resolve => setImmediate(resolve))
test('agrega somente IDs enfileirados, sem duplicar, em lotes de até quatro', async () => {
  const batches=[]
  const queue=createAreaCentralRefreshQueue(async ids=>{batches.push(ids)},()=>true,()=>assert.fail())
  for(let id=1;id<=9;id++) { queue.enqueue(id); queue.enqueue(id) }
  await flush()
  assert.deepEqual(batches,[[1,2,3,4],[5,6,7,8],[9]])
  queue.enqueue(1);await flush();assert.equal(batches.length,3)
  queue.reset();queue.enqueue(1);await flush();assert.deepEqual(batches[3],[1])
})
test('não consulta tela inativa e não faz loop de retry em caso de falha', async()=>{
  let active=false, calls=0, errors=0
  const queue=createAreaCentralRefreshQueue(async()=>{calls++;throw new Error('falha fictícia')},()=>active,()=>{errors++})
  queue.enqueue(1);await flush();assert.equal(calls,0)
  active=true;queue.enqueue(1);await flush();queue.enqueue(1);await flush()
  assert.equal(calls,1);assert.equal(errors,1)
})

test('trocar filtro descarta pendências fora da tela e salvar parâmetros permite nova consulta',async()=>{
  const batches=[], queued=[]; let release; let relevant=new Set([1,2,3,4,5,6]);
  const queue=createAreaCentralRefreshQueue(async ids=>{batches.push(ids);if(batches.length===1) await new Promise(resolve=>{release=resolve})},()=>true,()=>assert.fail(),id=>queued.push(id),id=>relevant.has(id));
  [1,2,3,4,5,6].forEach(id=>queue.enqueue(id)); await flush();
  relevant=new Set([7]);queue.enqueue(7);release();await flush();
  assert.deepEqual(batches,[[1,2,3,4],[7]]);
  queue.reset();queue.enqueue(7);await flush();assert.deepEqual(batches[2],[7]);
  assert.deepEqual(queued,[1,2,3,4,5,6,7,7]);
});
