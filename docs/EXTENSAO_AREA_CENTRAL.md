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
   RedeASSO oferece **Concluir e entrar**, com proteção CSRF e rotação de sessão.
6. O jar fica no envelope AES-GCM da sessão JDBC/Neon por no máximo 12 horas,
   respeitando expiração/revogação externa. A senha nunca passa pela extensão
   nem por esse novo fluxo Spring. Logout do RedeASSO remove o envelope, mas
   não faz logout no portal do Chrome, e vice-versa. Após logout externo,
   revogação pode ser reconhecida somente na próxima consulta ao portal.

O identificador exibido inicialmente é **Área Central**, extraído como identidade
genérica após validação. Não aceitamos um nome arbitrário do cliente como
identidade real. A extração confiável do identificador individual é pendente.

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

## Homologação e limitações

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
