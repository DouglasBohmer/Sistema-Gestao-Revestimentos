import {test} from 'node:test';
import assert from 'node:assert/strict';
import {preencherCadastro,abrirPesquisaPiso,pesquisaPisoUrl} from './cadastro-area-central.ts';
const base={nome:'',codigoRede:'123',codigoLoja:'',m2PorCaixa:0,rejunte:2,acabamentoBordas:'RETIFICADO',ativo:false,valor:0,estoqueM2:0};
const consulta={codigoRede:'123',encontrado:true,nome:'PISO FICTÍCIO 62X122 BOLD',valorBrutoM2:10,valorVendaM2:16.75,estoqueM2:0,statusAreaCentral:'ACABAR',m2PorCaixa:2.28,linkFoto:'https://exemplo.com/foto.jpg',largura:62,altura:122,acabamentoBordas:'BOLD',cadastros:[]};
test('novo rascunho usa dados confirmados, mantém zero real e não calcula preço no React',()=>{
  const result=preencherCadastro(base,consulta);
  assert.equal(result.nome,consulta.nome);assert.equal(result.m2PorCaixa,2.28);assert.equal(result.valor,16.75);
  assert.equal(result.estoqueM2,0);assert.equal(result.largura,62);assert.equal(result.altura,122);assert.equal(result.rejunte,5);
  assert.equal(result.ativo,true);assert.equal(base.nome,'');assert.equal('id' in result,false);
  assert.throws(()=>preencherCadastro(base,{...consulta,encontrado:false}));
});
test('cadastro local preserva ficha técnica, CTC, fotos e URLs; portal atualiza nome/múltiplo/preço/estoque',()=>{
  const local={...base,id:9,nome:'Nome antigo',codigoLoja:'CTC-9',largura:60,altura:60,m2PorCaixa:1.44,localDeUso:'Uso comprovado',classificacaoUso:'LE',linkFoto:'/product-images/foto.webp',linkPaginacao:'https://exemplo.com/ambiente.webp'};
  const result=preencherCadastro(base,consulta,local);
  assert.equal(result.codigoLoja,'CTC-9');assert.equal(result.largura,60);assert.equal(result.localDeUso,'Uso comprovado');
  assert.equal(result.linkFoto,local.linkFoto);assert.equal(result.linkPaginacao,local.linkPaginacao);assert.equal(result.classificacaoUso,'LE');
  assert.equal(result.m2PorCaixa,2.28);assert.equal(result.nome,consulta.nome);assert.equal('id' in result,false);
});
test('campo ausente não apaga valor do rascunho e foto enviada tem prioridade',()=>{
  const result=preencherCadastro({...base,m2PorCaixa:1.5,linkFoto:'/product-images/enviada.webp'}, {...consulta,m2PorCaixa:null,largura:null,altura:null,acabamentoBordas:null});
  assert.equal(result.m2PorCaixa,1.5);assert.equal(result.largura,undefined);assert.equal(result.linkFoto,'/product-images/enviada.webp');
});
test('guia reservada no Enter pesquisa só nome codificado, sem opener e sem tocar em guia navegada',()=>{
  let navigated,closed=false,opening;
  const tab={closed:false,opener:{},document:{title:'',body:{}},location:{href:'about:blank',replace:url=>{navigated=url}},close(){closed=true}};
  const handle=abrirPesquisaPiso((url,target)=>{opening={url,target};return tab});
  assert.deepEqual(opening,{url:'about:blank',target:'_blank'});assert.equal(tab.opener,null);
  handle.pesquisar('Piso & Ação 60x60');assert.equal(navigated,pesquisaPisoUrl('Piso & Ação 60x60'));
  assert.equal(new URL(navigated).searchParams.get('q'),'Piso & Ação 60x60');
  tab.location.href='https://outro.example';navigated=null;handle.pesquisar('outro');handle.fechar();assert.equal(navigated,null);assert.equal(closed,false);
  tab.location.href='about:blank';handle.fechar();assert.equal(closed,true);
  assert.equal(abrirPesquisaPiso(()=>null),null);assert.equal(abrirPesquisaPiso(()=>{throw new Error('bloqueado')}),null);
});
