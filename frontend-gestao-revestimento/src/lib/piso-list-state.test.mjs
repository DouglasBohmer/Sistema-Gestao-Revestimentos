import {test} from 'node:test';
import assert from 'node:assert/strict';
import {filterPisos, EMPTY_PISO_FILTERS, stockCellState} from './piso-list-state.ts';

test('filtros combinados preservam ordem e Todos inclui inativos',()=>{
  const pisos=[{id:1,ativo:false,tipoPiso:'Acetinado',classificacaoUso:'LA',acabamentoBordas:'RETIFICADO'},
    {id:2,ativo:true,tipoPiso:'ACETINADO',classificacaoUso:'LD',acabamentoBordas:'BOLD'},
    {id:3,ativo:true,tipoPiso:null,classificacaoUso:'LD',acabamentoBordas:'RETIFICADO'}];
  assert.deepEqual(filterPisos(pisos,EMPTY_PISO_FILTERS),pisos);
  assert.deepEqual(filterPisos(pisos,{...EMPTY_PISO_FILTERS,onlyActive:true}).map(p=>p.id),[2,3]);
  assert.deepEqual(filterPisos(pisos,{onlyActive:true,tipo:' acetinado ',classificacao:'LD',bordas:'BOLD'}).map(p=>p.id),[2]);
  assert.equal(filterPisos(pisos,{...EMPTY_PISO_FILTERS,tipo:'polido'}).length,0);
  assert.equal(filterPisos(undefined,EMPTY_PISO_FILTERS),undefined);
  assert.equal(pisos.length,3);
});
test('carregamento externo nunca aparece como zero e falha sem dado não vira Atualizando eterno',()=>{
  const piso={codigoRede:'1234567',ultimaConsultaAreaCentralEm:null,statusAreaCentral:null};
  assert.equal(stockCellState(piso,true),'UPDATING');
  assert.equal(stockCellState(piso,true,'UPDATING'),'UPDATING');
  assert.equal(stockCellState(piso,true,'FAILED'),'UNAVAILABLE');
  assert.equal(stockCellState({...piso,ultimaConsultaAreaCentralEm:'2026-11-06'},true,'FAILED'),'READY');
  assert.equal(stockCellState({...piso,statusAreaCentral:'NAO_ENCONTRADO'},true,'NOT_FOUND'),'NOT_FOUND');
  assert.equal(stockCellState({...piso,codigoRede:null},true),'READY');
  assert.equal(stockCellState({...piso,origemValor:'MANUAL'},false),'READY');
});
