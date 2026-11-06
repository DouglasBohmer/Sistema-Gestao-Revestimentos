# Login da Área Central no navegador do usuário

Decisão autorizada em 15/10/2026. Produção continua em **Neon + Render +
Cloudflare**. O Chrome/Edge do usuário faz o login real; não há servidor,
Docker local, Tailscale, Chromium ou noVNC necessário para esse caminho.

## Instalar uma vez em cada computador

1. Após o deploy, acesse `https://redeasso.assocom.workers.dev` e expanda
   **Instalar a extensão RedeASSO**. Baixe o ZIP e extraia em pasta permanente.
   Alternativamente, use a pasta `extensions/redeasso-area-central` deste Git.
2. Abra `chrome://extensions` ou `edge://extensions`.
3. Ative **Modo do desenvolvedor**, clique em **Carregar sem compactação** e
   selecione a pasta que contém `manifest.json`, não o ZIP.
4. Confira o código/permissões: somente `redeasso.areacentral.com.br` e
   `redeasso.assocom.workers.dev`; cookies, armazenamento transitório e alarme
   de expiração. Não há acesso global, histórico, depuração, senha ou scripts
   remotos. A permissão de cookies é necessária para ler inclusive `HttpOnly`.
5. Recarregue a guia RedeASSO após instalar/atualizar. A extensão do GPT é outra
   extensão e **não** faz parte do produto nem substitui esta instalação.

Modo do desenvolvedor é distribuição interna inicial. Não desative proteções
do navegador ou da empresa. Uma política corporativa pode bloquear a carga;
nesse caso, o administrador deverá aprovar a distribuição. Para distribuição
mais ampla, publicar na Chrome Web Store é uma etapa separada, não realizada.

## Entrar

1. No RedeASSO, clique em **Entrar com Área Central**.
2. A extensão abre diretamente
   `https://redeasso.areacentral.com.br/401/?pg=associado_catalogos_produtos&ordenacao=nome-asc`.
   Se o portal já reconhecer sua sessão, ela pode ser reutilizada.
3. Se necessário, informe usuário/senha **no próprio portal**. O Chrome pode
   preencher credenciais já salvas. Se ambos os campos estiverem preenchidos
   pelo autofill do navegador, a extensão aguarda o Turnstile legítimo liberar
   o botão e envia **Entrar** uma única vez. Sem autofill, preencha e clique
   em **Entrar** manualmente. A extensão não lê a senha nem interage com CAPTCHA.
4. Ao carregar o catálogo, a extensão envia somente `PHPSESSID`, `cf_clearance`
   e `__cf_bm` existentes e pertinentes ao portal diretamente por HTTPS ao
   backend, via domínio Cloudflare fixo. O React recebe apenas estado.
5. O Spring consulta o catálogo por conta própria e exige marcadores reais de
   produto/referência e ausência de formulário/desafio. Só então a guia
   RedeASSO conclui o acesso automaticamente, com proteção CSRF e rotação de
   sessão. Após essa confirmação, a extensão fecha somente a guia que abriu
   para a tentativa e retorna o foco ao app. Uma guia preexistente ou navegada
   para outra origem nunca é fechada. Em falha, a guia permanece disponível.
6. O jar fica no envelope AES-GCM da sessão JDBC/Neon por no máximo 12 horas,
   respeitando expiração/revogação externa. A senha nunca passa pela extensão
   nem por esse novo fluxo Spring. Logout do RedeASSO remove o envelope, mas
   não faz logout no portal do Chrome, e vice-versa. Após logout externo,
   revogação pode ser reconhecida somente na próxima consulta ao portal.

Uma tentativa recusada já consumiu sua concessão e não pode ser reenviada.
**Tentar novamente** revoga o estado anterior no servidor e na extensão antes
de emitir outra concessão e reabrir a guia do portal. Não exige sair da conta
da Área Central, reinstalar a extensão ou recarregar manualmente todo o app.

O identificador exibido inicialmente é **Área Central**, extraído como identidade
genérica após validação. Não aceitamos um nome arbitrário do cliente como
identidade real. A extração confiável do identificador individual é pendente.

### Atualização da extensão para o retorno automático

A versão **1.1.0** usa o protocolo 2, sem permissões novas. Atualize os arquivos
da pasta carregada sem compactação (ou baixe novamente o ZIP publicado), clique
**Recarregar** em `chrome://extensions` e recarregue a guia do RedeASSO. Uma
instalação antiga é detectada antes de abrir a tentativa e orienta atualizar;
Git/Cloudflare não atualizam automaticamente uma pasta em Downloads.

## Preço e estoque em tempo real

O Spring consulta a mesma busca filtrada do EstoqueScraper legado: POST na URL
fixa do catálogo, `filtro[]=PF.REFERENCIA`, `operador[]=IGUAL` e o código ASSO.
Não usa cookie global, senha salva ou navegador remoto. A referência retornada
precisa coincidir com a solicitada; não escolher silenciosamente outro produto.

Na lista, somente as linhas visíveis (com pequena margem de pré-carregamento)
entram na fila, em lotes de até quatro e no máximo duas consultas HTTP externas
simultâneas. A fila não roda em tela oculta ou durante a edição do formulário.
**Atualizar visíveis** permite nova tentativa. Nenhuma busca é iniciada pelo
health check, por cron do banco ou para importar todo o catálogo no login.

`POST /api/pisos/area-central/atualizar` exige autenticação do app e CSRF. Cada
resultado é `UPDATED`, `NOT_FOUND`, `MANUAL` ou `FAILED`. A sessão externa é a
do usuário atual. Pisos sem código ASSO permanecem manuais. Falhas, timeouts,
HTML incompatível e sessão expirada não apagam nem zeram dados. Apenas uma
mensagem explícita de ausência, com filtro/código/operador conferidos no HTML,
desativa o produto; os últimos valores continuam preservados.

O valor retornado pelo portal é bruto por m². O preço de venda usa os parâmetros
persistidos `PRECO_LUCRO_PERCENTUAL` e `PRECO_DESCONTO_PERCENTUAL` (padrões 90%
e 12%), com BigDecimal. Após precisão monetária HALF_UP, aplica as faixas comerciais
de centavos: 00–20 → 00, 21–50 → 50, 51–75 → 75 e 76–99 → próximo inteiro.
Isso vale para o preço unitário por m²; o total não recebe as faixas novamente.
O exemplo bruto de 44,52 gera 74,50/m² com os padrões e a nova regra.
Estoque continua
em m²; m²/caixa, nome e outros dados técnicos não são alterados pela consulta.
Antes de calcular com uma conta externa conectada, o backend atualiza o piso
consultável fora da transação do cálculo, evitando valor novo com estoque velho
ou conexão Neon aberta enquanto espera o portal.

No cadastro, **Parâmetros** oferece somente margem sobre o bruto e desconto,
mais Salvar. `GET/PUT /api/parametros/preco` lê/persiste o par no Neon, com
versões de edição, transação única, CSRF e atividade de auditoria dos valores
anteriores/novos. Desconto aceita 0–100; margem não negativa. Versão antiga
retorna 409 em vez de sobrescrever outra sessão. Salvar reconsulta apenas os
visíveis, sem carga global ou alteração dos outros parâmetros do cálculo.

**Filtros** combina tipo, classificação de uso e acabamento de bordas; o
switch Todos/Ativos inicia em Todos e não muda o cadastro. Durante uma consulta,
as células mostram **Atualizando...**; falha sem dado conhecido mostra
**Indisponível**, não um falso zero. Uma consulta válida pode confirmar zero.

Downloads filtrados têm limite de 2 MiB e HTML descompactado de 4 MiB, timeout
HTTP de 10 segundos e espera máxima de 12 segundos por produto. Falhas geram
apenas `area_central_product_query_failed`, categoria, status HTTP e duração;
nenhum cookie, código do produto, conta, HTML ou mensagem externa vai ao log.

## Configurar produção

- Um único serviço Render: `redeasso-api`, com `Dockerfile.render` e contexto
  da raiz. A imagem passa a executar somente Java; nenhum navegador remoto.
- `APP_ADDRESS=0.0.0.0`; não manter `APP_ADDRESS=127.0.0.1` do runtime antigo.
  `PORT` é fornecida pelo Render. Docker Command vazio.
- `REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED=true`.
- Preserve a chave **estável** `AREA_CENTRAL_SESSION_ENCRYPTION_KEY`, 32 bytes
  em Base64, já configurada. Sem ela, o fallback em memória não sobrevive ao
  restart; nunca troque automaticamente uma chave existente.
- Neon, sessão HTTPS/HttpOnly, CSRF, Worker `/api` e health ping não mudam.
  O health ping não acessa o Neon nem chama a Área Central.
- Variáveis antigas de gateway/URL noVNC/Funnel não são usadas pelo novo fluxo.
  O serviço antigo de navegador suspenso não deve ser retomado. Código/Compose
  remoto permanece somente como fallback de desenvolvimento, não aparece no
  login principal e não é iniciado no Render.
- Deploy da `main` continua automático. A extensão é empacotada no build e
  publicada como `/extensions/redeasso-area-central.zip`, sem segredos. Atualize
  arquivos locais e clique **Recarregar** na extensão para receber nova versão;
  a distribuição sem compactação não atualiza automaticamente pelo Git.

## Protocolo e proteções

`POST /api/auth/area-central/browser-transfers` exige a sessão original e CSRF.
Emite concessão de 256 bits, dez minutos, vinculada àquela sessão. Não contém
cookies e não pode ir para URL, log, disco permanente ou analytics.

Somente `POST .../receive` usa essa concessão de uso único no lugar de CSRF;
não recebe cookie da sessão RedeASSO nem cria autenticação própria. Corpo
limitado a 32 KiB, cookies com allowlist, domínio/path/expiração validados,
sem redirects externos, sem logs de corpos. Máximo de 100 tentativas pendentes
e duas validações de catálogo simultâneas. Cancelar, reiniciar tentativa ou
expirar revoga a concessão. Restart do Render descarta tentativas pendentes,
mas não as sessões já concluídas e criptografadas com a chave estável.

`GET .../current` retorna somente estado. `POST .../complete` exige sessão
original e CSRF, consome o resultado validado e usa a autenticação existente.
`DELETE .../current` exige CSRF e cancela. A ponte `postMessage` de origem exata
transporta comandos e a concessão curta, **nunca cookies nem senha**. Cookies
só existem transitoriamente no background e no backend. A extensão não vigia
guias arbitrárias: apenas a guia que ela abriu para a tentativa atual.

## Diagnosticar uma sessão recusada

Depois do deploy da API, reproduza uma tentativa e, em **Render → redeasso-api
→ Logs**, filtre por `area_central_session_validation_failed`. Esta alteração
é somente no backend: não exige reinstalar a extensão ou configurar variáveis.
Cada falha de validação do catálogo gera um único aviso, por exemplo fictício:

```text
area_central_session_validation_failed reason=HTTP_FORBIDDEN upstream_status=403 duration_ms=123
```

O aviso contém somente uma categoria predefinida, o status HTTP recebido e a
duração em milissegundos. `upstream_status=unavailable` significa que nenhum
status foi recebido. Nunca inclui cookies, senha, conta, concessão, sessão,
HTML, cabeçalhos, mensagens externas ou stack traces.

| Categoria | O que foi observado |
| --- | --- |
| `HTTP_REDIRECT`, `HTTP_UNAUTHORIZED`, `HTTP_FORBIDDEN`, `HTTP_RATE_LIMITED`, `HTTP_ERROR` | Resposta diferente de 200; consulte o status numérico. Redirects não são seguidos. Um 403 não prova, sozinho, bloqueio de IP ou Cloudflare. |
| `UNEXPECTED_CONTENT_TYPE` | Resposta 200 sem tipo HTML. |
| `HUMAN_VERIFICATION_REQUIRED`, `LOGIN_FORM_PRESENT` | HTML contém widget de verificação ou formulário de login; não há catálogo autenticado aceito. |
| `CATALOG_FILTER_MISSING`, `CATALOG_PRODUCTS_MISSING` | O HTML não contém os marcadores esperados. Pode ser outro documento ou mudança no portal; não afrouxar a validação para liberar acesso. |
| `TIMEOUT`, `TLS_ERROR`, `DNS_ERROR`, `CONNECTION_ERROR`, `NETWORK_ERROR` | A comunicação falhou; a categoria não revela mensagens da exceção. |
| `RESPONSE_TOO_LARGE` | Download excedeu 16 MiB, ou HTML descompactado excedeu 32 MiB; a validação foi interrompida. |
| `INVALID_RESPONSE_BODY`, `UNSUPPORTED_CONTENT_ENCODING` | Corpo compactado inválido/truncado ou codificação não suportada. |
| `MISSING_SESSION_COOKIE`, `INTERRUPTED`, `UNEXPECTED_ERROR` | Cookie de sessão ausente, execução interrompida ou falha interna não classificada. |

Um status pode aparecer mesmo se o download do corpo falhar depois. Os avisos
cobrem a consulta do catálogo pelo verificador, não todas as recusas anteriores
(por exemplo, concessão expirada ou payload inválido). Compartilhe somente essa
linha sanitizada e o horário da tentativa; não copie corpos de requisição,
cookies ou credenciais. Não habilite logs HTTP de baixo nível para investigar.
A mensagem mostrada ao usuário e as regras de autenticação permanecem iguais;
instrumentação não significa que o login real foi homologado.

Em 30/10/2026, duas tentativas reais no Render retornaram HTTP 200 e
`RESPONSE_TOO_LARGE`: o limite antigo de 4 MiB interrompia a leitura antes
de validar os marcadores. Isso comprova o ponto de falha, não que o HTML
incompleto já estivesse autenticado. A correção solicita gzip e usa o
[StreamParser do jsoup](https://jsoup.org/cookbook/input/streamparser-dom-sax)
para descartar os elementos processados sem criar uma String/DOM completos.
O download fica limitado a 16 MiB e a descompactação a 32 MiB, inclusive
contra gzip expansivo. Os 30 segundos de validação e as duas validações
simultâneas continuam limitados. O documento é consumido até o fim antes
de aceitar o acesso: um formulário/desafio no final também o recusa.

## Homologação e limitações

Em 06/11/2026, o commit `48e69ff` foi publicado no Cloudflare e ficou Live no
Render, com os dois workflows aprovados. Após atualizar a extensão para 1.1.0,
o teste autorizado no Chrome reutilizou a sessão legítima do portal: a SPA
entrou sem botão de confirmação e a guia criada pela extensão foi fechada.
A outra guia do catálogo, aberta para comparação, permaneceu intacta. Não
houve leitura de senha ou interação com CAPTCHA pelo agente.

A busca visível pelo ASSO `2183343` atualizou automaticamente o produto para
estoque de **104,88 m²** e venda de **R$ 74,44/m²**, conferidos com **R$ 44,52/m²**
bruto no portal e os parâmetros 90%/12%. O m²/caixa cadastrado permaneceu 2,28.
Recarregar o app após o login na API nova preservou autenticação e dados,
sem alertas de falha. A primeira tentativa ocorreu durante o deploy e exigiu
reconectar após a troca da instância; não considerar sobrevivência a restart
homologada com esse teste. O limite de 12 horas, contas distintas e demais
cenários abaixo continuam exigindo verificação própria.

Em 30/10/2026, o commit `526383c` ficou Live no Render e Ready no Cloudflare,
com ambos os workflows GitHub aprovados. No teste operacional autorizado,
a extensão já instalada reutilizou uma conta aberta no Chrome, o Spring
validou o catálogo e a tela exibiu **Sessão validada pelo servidor**.
**Concluir e entrar** abriu o dashboard; recarregar preservou o acesso.
Nenhuma senha foi extraída e não houve interação com CAPTCHA. Não foi
necessário reinstalar a extensão. Essa confirmação é pontual: duração de
12 horas, outras contas e consultas individuais de produtos ainda exigem
validação própria; não presumir que toda sessão será aceita pelo portal.

O teste manual anterior confirmou o login direto no Chrome com Turnstile
aprovado espontaneamente. Isso **não** prova que os cookies serão aceitos em
uma conexão feita pelo Render: Cloudflare/portal pode vincular sessão ao IP
ou exigir novas verificações. Não falsificar User-Agent/fingerprint, tokens
ou confirmação para contornar a recusa. Se houver `REJECTED`, nenhum acesso
é liberado; registrar somente status sanitizado e avaliar integração permitida
com o responsável pelo portal.

Depois da instalação e do deploy, testar com autorização explícita:

- sessão já aberta e sessão nova; credenciais incorretas; CAPTCHA manual;
- catálogo validado pelo Render, primeira consulta real de produto e isolamento
  entre contas; catálogo sem produtos é recusado de forma fechada nesta versão;
- cancelar, fechar/reabrir guia, expirar dez minutos, reiniciar Render;
- concluir somente na guia original, logout, reabrir app e limite de 12 horas;
- ausência/recarregamento da extensão e origem não permitida;
- confirmar ausência de cookies/senha em React, logs, URLs e persistência clara.

Testes automatizados usam somente dados fictícios e não fazem login real.
Não considerar essa homologação concluída apenas porque o build passou.

Referências técnicas: [Chrome Cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies),
[content scripts isolados](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
e [storage de sessão](https://developer.chrome.com/docs/extensions/reference/api/storage).
