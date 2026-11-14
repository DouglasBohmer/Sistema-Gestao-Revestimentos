# Configurações, histórico e resumo da venda

Implementação na branch `feat/configuracoes-historico-resumo-venda`. Não foi
publicada em produção nem integrada à main nesta tarefa.

## Comportamento

- Início mostra os últimos 15 cálculos do sistema em geral e os últimos 15
  pisos por data de cadastro (não pela atualização de preço/estoque).
- Reabrir busca o resultado original salvo, inclusive produto, preço, medidas,
  quantidades e parâmetros efetivamente usados. Não consulta a Área Central,
  não recalcula e não cria outra atividade. Alterar/excluir o produto depois
  não modifica o resultado histórico. Cálculos anteriores à implantação não
  são reconstruídos a partir das atividades textuais.
- Um novo cálculo, ao contrário, usa dados atuais. Ao reabrir, a entrada fica
  no modo caixas com as caixas vendidas originalmente; um aviso distingue
  claramente a reprodução histórica de uma nova venda.
- O olho oculta apenas o preço na tela de cálculo. É preferência visual,
  não controle de acesso. As outras telas não mudam. Com o olho fechado, o
  texto de compartilhamento também omite o valor.
- O resumo abre automaticamente após calcular ou reabrir, e o botão **Resumo
  da venda** permite abri-lo de novo. Mostra “M² Digitar no Cupom”, caixas,
  sacos de argamassa, embalagens de rejunte e pacotes/peças de niveladores.
  Quantidade não calculável aparece como “Não calculado”, nunca zero inventado.
- Configurações permite salvar as cinco cores com proteção contra edição
  concorrente e auditoria. Mantidos PADRAO, ACABAR, NEGOCIACAO, Fora de linha e
  Produto local. Status desconhecidos são preservados em cinza; não viram
  Padrão. Ativo/Inativo e saldo continuam independentes das cores.
- O arquivo de sessão é opcional e configurado por navegador/loja na extensão;
  veja [EXTENSAO_AREA_CENTRAL.md](EXTENSAO_AREA_CENTRAL.md).

## API e persistência

- `GET /api/calculos/historico`: até 15 resumos, ordenados por data/ID decrescentes.
- `GET /api/calculos/historico/{id}`: snapshot original ou 404, sem mutação.
- `GET /api/pisos/recentes`: até 15 cadastros por data/ID decrescentes.
- `GET/PUT /api/configuracoes/status`: paleta de cinco cores e versões.
- Todas exigem autenticação; PUT também exige CSRF. Não foi criado papel novo.
- Flyway V11 adiciona `calculos_historico` (snapshot e parâmetros JSONB, sem FK
  destrutiva para piso) e `status_cores`. Snapshot e atividade são gravados na
  mesma transação do cálculo. Não há senha/cookie nesses registros.

## Implantação e rollback

Antes de integrar a main, validar a branch com PostgreSQL isolado e garantir
backup restaurável/branch de recuperação no Neon conforme o procedimento da
loja. O CI executa Testcontainers PostgreSQL 17, sem usar o Neon de produção.
Esta migration é aditiva: rollback do código pode manter as duas tabelas,
sem apagar histórico nem remover migrations já aplicadas. Não executar DROP
ou baixar a versão Flyway em produção. Ao retomar a versão nova, o histórico
continuará disponível. Não reconstruir cálculos que ocorreram com o código antigo.

Após publicação autorizada, atualizar manualmente a extensão para **1.2.1**,
recarregar a extensão e a aba do app, selecionar o `.txt` em cada PC e testar:
primeiro login grava; segundo PC reutiliza; arquivo inacessível/expirado abre
login normal; desligar a rede não apaga arquivo nem concede acesso sem validar.
