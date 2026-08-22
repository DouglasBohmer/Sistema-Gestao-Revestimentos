# Publicação gerenciada: Neon + Render + Cloudflare Workers

Este é o caminho de produção do RedeASSO. O Docker Compose local continua
disponível para desenvolvimento e contingência, mas não é parte da publicação
na nuvem.

## 1. Criar o banco no Neon

1. Crie o projeto Neon na região mais próxima do serviço Render escolhido.
2. Crie uma branch de produção vazia e obtenha a **conexão direta** (unpooled),
   com SSL. Não use a URL que contém `-pooler` nesta primeira instância.
3. No Render, configure os segredos abaixo a partir dessa conexão:

| Variável | Valor |
| --- | --- |
| `DATABASE_URL` | URL JDBC, por exemplo `jdbc:postgresql://ep-...neon.tech/neondb?sslmode=require` |
| `DATABASE_USERNAME` | usuário da conexão Neon |
| `DATABASE_PASSWORD` | senha da conexão Neon |
| `REDEASSO_LOCAL_ADMIN_USERNAME` | usuário local temporário forte |
| `REDEASSO_LOCAL_ADMIN_PASSWORD` | senha local temporária forte |

O primeiro deploy do Spring executa as migrations Flyway V1 a V4. Antes desse
deploy, escolha explicitamente entre iniciar com os dados demonstrativos ou
migrar a base local. A importação de dados existentes **não** deve ser feita
em cima de um banco Neon já iniciado sem backup e sem conferência prévia.

## 2. Criar o serviço Render

No painel Render, crie um **Blueprint** a partir deste repositório. O arquivo
`render.yaml` cria o serviço `redeasso-api` a partir de
`backend-gestao-revestimento/Dockerfile.render`, já fixado em Ohio para ficar
próximo do projeto Neon.

O Blueprint usa `plan: free`, portanto não deve solicitar cartão. O Worker
Cloudflare tem um cron de 10 minutos que consulta `/actuator/health` e evita a
suspensão por inatividade. Isso mantém o serviço ativo, mas consome quase todas
as 750 horas gratuitas mensais do workspace; acompanhe esse consumo no Render.

Preencha os cinco segredos da tabela anterior. Mantenha os demais valores do
Blueprint, em particular:

- `SPRING_PROFILES_ACTIVE=prod`;
- `SESSION_COOKIE_SECURE=true`;
- `REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED=false`, até concluir a seção 3.1
  abaixo.

Depois do deploy, guarde a URL HTTPS pública da API, sem barra final, por
exemplo `https://redeasso-api.onrender.com`.

### 2.1 Habilitar o navegador assistido da Área Central

Chrome gráfico/noVNC não cabe com confiabilidade na memória do plano Free do
Render. Ele roda no servidor Docker da loja; API, banco e frontend continuam
na nuvem. O login externo só fica disponível enquanto esse servidor e o Funnel
estiverem ligados. O usuário digita a senha e confirma o CAPTCHA diretamente
nesse Chrome; o RedeASSO não usa WebDriver no login.

1. No servidor, copie `.env.example` para `.env` caso ainda não exista e
   preencha, com os mesmos valores configurados na API Render:

   ```text
   AREA_CENTRAL_BROWSER_SERVICE_KEY=<mesmo valor da API Render>
   AREA_CENTRAL_INTERACTIVE_TOKEN_SECRET=<mesmo valor da API Render>
   AREA_CENTRAL_ALLOWED_FRAME_ORIGIN=https://redeasso.assocom.workers.dev
   AREA_CENTRAL_BROWSER_BIND_ADDRESS=127.0.0.1
   AREA_CENTRAL_BROWSER_PORT=7900
   ```

2. A `main` publica a imagem do navegador no GHCR. No servidor, puxe e inicie
   somente o navegador:

   ```powershell
   docker compose -f docker-compose.area-central-browser.server.yml pull area-central-browser
   docker compose -f docker-compose.area-central-browser.server.yml up -d area-central-browser
   docker compose -f docker-compose.area-central-browser.server.yml ps
   curl.exe http://127.0.0.1:7900/healthz
   ```

   O Watchtower já instalado verifica a tag
   `area-central-browser-main` a cada cinco minutos. Assim, commits futuros na
   `main` atualizam tanto a API (`main`) quanto o navegador sem `git pull` no
   servidor.

3. O Funnel atual em `https://usuario-pc.tailbc9bf3.ts.net` encaminha para o
   Apache e deve ser preservado. Em um PowerShell administrativo no servidor,
   publique o gateway em uma segunda porta HTTPS:

   ```powershell
   tailscale funnel --bg --https=8443 http://127.0.0.1:7900
   tailscale funnel status
   curl.exe https://usuario-pc.tailbc9bf3.ts.net:8443/healthz
   ```

   O `--bg` faz o Funnel voltar após reiniciar o computador ou o Tailscale.
   Nunca aponte o Funnel para 4444 ou 7900 dentro do contêiner: a única porta
   publicada deve ser a do gateway local `127.0.0.1:7900`.

4. No serviço `redeasso-api` do Render, configure:

   | Variável | Valor |
   | --- | --- |
   | `AREA_CENTRAL_BROWSER_GATEWAY_URL` | `https://usuario-pc.tailbc9bf3.ts.net:8443` |
   | `AREA_CENTRAL_INTERACTIVE_URL` | `https://usuario-pc.tailbc9bf3.ts.net:8443/vnc.html` |
   | `AREA_CENTRAL_READ_TIMEOUT` | `90s` |
   | `REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED` | `true` |

   `AREA_CENTRAL_BROWSER_SERVICE_KEY` e
   `AREA_CENTRAL_INTERACTIVE_TOKEN_SECRET` continuam com os mesmos valores do
   `.env` do servidor. Depois, faça redeploy da API.

5. Quando o endpoint local estiver saudável, suspenda ou remova do painel
   Render o antigo `redeasso-area-central-browser`, que não é mais usado e
   excede a memória do plano Free. O `render.yaml` não o declara mais.

Se o contêiner reiniciar, colete o diagnóstico antes de tentar novamente:

```powershell
docker compose -f docker-compose.area-central-browser.server.yml logs --tail 200 area-central-browser
docker compose -f docker-compose.area-central-browser.server.yml ps
```

Nunca abra `/internal/browser/*` ou `/internal/access/*` no navegador: sem a chave
interna eles retornam `401`. O `/vnc.html` isoladamente também não dá acesso à
sessão; o websocket exige uma concessão ativa e o token temporário emitido
pelo Spring. Não coloque nenhum desses segredos em Cloudflare, `wrangler`,
`VITE_*`, URL fixa ou Git.

## 3. Criar o Worker Cloudflare

No Cloudflare Workers, conecte este repositório por **Workers Builds** e use:

| Campo | Valor |
| --- | --- |
| Diretório raiz | `frontend-gestao-revestimento` |
| Comando de build | `corepack enable && corepack prepare pnpm@11.21.0 --activate && pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run build` |
| Comando de deploy | `pnpm --filter @workspace/redeasso exec wrangler deploy --config wrangler.jsonc` |
| Branch de produção | `main` |

`API_ORIGIN` já está versionada em `wrangler.jsonc` com a URL pública do Render.
Se a URL da API mudar, atualize esse arquivo e publique uma nova versão do
Worker. Ela é lida pelo Worker, nunca pelo bundle React.

Também crie a variável **de build** `SKIP_DEPENDENCY_INSTALL=true`, evitando
que o instalador automático do Cloudflare execute uma segunda instalação com
uma versão diferente do pnpm.

O Worker serve a SPA e encaminha `/api/*` ao Render. Isso faz com que sessão,
CSRF e cookies permaneçam no mesmo domínio Cloudflare, sem CORS permissivo.
O mesmo Worker executa um Cron Trigger `*/10 * * * *`, que faz uma chamada
`GET /actuator/health` ao Render. Esse ping não acessa dados de negócio, banco
nem sessões de usuários.

## 4. Automação por branch

- Todo push passa em `.github/workflows/verify.yml` (React, Worker em dry-run
  e testes Spring).
- `main`: depois de os checks passarem, o Render publica a API; o Workers
  Builds publica a SPA de produção diretamente da integração Git.
- Outras branches e pull requests: `.github/workflows/docker.yml` constrói a
  imagem Docker de fallback. Mantenha os previews Cloudflare desativados até
  existir uma API Render e branch Neon de homologação; eles nunca podem usar
  os dados de produção.

Cloudflare Workers não recebe nem executa imagens Docker. Portanto o Docker é
a barreira de validação e contingência; o Worker recebe o bundle estático
gerado pelo Vite.

## 5. Homologação após a primeira publicação

1. Abra a URL Cloudflare e confirme que as rotas SPA, inclusive uma rota
   interna como `/mapa-estoque`, retornam a aplicação.
2. Confirme `GET /api/healthz` pelo mesmo domínio Cloudflare.
3. Entre com as credenciais locais fortes configuradas no Render e execute uma
   leitura de pisos e uma alteração de mapa.
4. Confirme no Neon que migrations, sessões, pisos e mapas foram persistidos.
5. Registre um backup Neon e faça um ensaio de rollback antes de habilitar o
   uso operacional.

Não publique `admin/admin`, URL de banco, senha ou cookies no Git, no Worker
ou em variáveis `VITE_*`.
