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
- `REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED=false`.

O último item é deliberado: o noVNC/Selenium local não pode ser exposto no
Render como se fosse uma API. A tela do RedeASSO pode enviar credenciais
efêmeras ao Spring para preencher o Chrome isolado, mas o CAPTCHA continua
manual e aparece em modal. O login assistido será habilitado em produção
somente quando houver um serviço de navegador isolado, protegido e com URL de
acesso temporária.

Depois do deploy, guarde a URL HTTPS pública da API, sem barra final, por
exemplo `https://redeasso-api.onrender.com`.

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
