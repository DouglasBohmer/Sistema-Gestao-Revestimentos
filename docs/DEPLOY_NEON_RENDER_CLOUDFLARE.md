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

O primeiro deploy do Spring executa as migrations Flyway V1 a V6. Antes desse
deploy, escolha explicitamente entre iniciar com os dados demonstrativos ou
migrar a base local. A importação de dados existentes **não** deve ser feita
em cima de um banco Neon já iniciado sem backup e sem conferência prévia.

## 2. Criar o serviço Render

No painel Render, crie um **Blueprint** a partir deste repositório. O arquivo
`render.yaml` cria o serviço `redeasso-api` a partir de
`backend-gestao-revestimento/Dockerfile.render`, já fixado em Ohio para ficar
próximo do projeto Neon.

O Blueprint usa `plan: free`, portanto não deve solicitar cartão. O Worker
Cloudflare tem um cron de 10 minutos que consulta `/api/healthz` e evita a
suspensão por inatividade. Isso mantém o serviço ativo, mas consome quase todas
as 750 horas gratuitas mensais do workspace; acompanhe esse consumo no Render.

Preencha os cinco segredos da tabela anterior. Mantenha os demais valores do
Blueprint, em particular:

- `SPRING_PROFILES_ACTIVE=prod`;
- `SESSION_COOKIE_SECURE=true`;
- `SESSION_CLEANUP_CRON=0 0 6 * * *` para limpar sessões expiradas uma vez ao
  dia, às 06:00 UTC (03:00 em Brasília), sem manter o Neon acordado por minuto;
- `SESSION_TIMEOUT=12h` e `SESSION_COOKIE_MAX_AGE=12h`;
- `AREA_CENTRAL_SESSION_ENCRYPTION_KEY`: segredo estável de 32 bytes em Base64,
  gerado pelo Blueprint. Preserve o mesmo valor nos próximos deploys;
- `REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED=true`, com o runtime abaixo.

Depois do deploy, guarde a URL HTTPS pública da API, sem barra final, por
exemplo `https://redeasso-api.onrender.com`.

### 2.1 Conectar a Área Central pela extensão

Decisão de 15/10/2026: o login principal acontece diretamente no Chrome/Edge
do usuário, pela extensão própria RedeASSO. A produção continua em **Neon +
Render + Cloudflare**, sem servidor local ou navegador remoto no Render.

1. Sincronize o Blueprint existente `redeasso-api`. Não crie nem retome o antigo
   `redeasso-area-central-browser`. Root Directory vazio, Dockerfile
   `backend-gestao-revestimento/Dockerfile.render`, contexto `.`, Docker Command
   vazio e Health Check Path `/api/healthz`.
2. Confirme `REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED=true` e
   `APP_ADDRESS=0.0.0.0`. Remova eventual override de `APP_ADDRESS=127.0.0.1`
   do runtime anterior. `PORT` é fornecida pelo Render.
3. Preserve `AREA_CENTRAL_SESSION_ENCRYPTION_KEY`: os mesmos 32 bytes em Base64
   dos deploys anteriores. Não gerar outra chave a cada publicação. Cookies
   externos continuam no envelope AES-GCM da sessão JDBC, por até 12 horas.
4. Publique a `main`. A imagem executa somente Spring/Java, sem Chromium, VNC,
   gateway ou Selenium. O ping de saúde continua independente do banco.
5. Instale a extensão em cada computador pelo link de download da tela de login.
   Siga [o guia da extensão](EXTENSAO_AREA_CENTRAL.md), que explica instalação,
   atualização, permissões, protocolo e homologação.
6. No RedeASSO, clique em **Entrar com Área Central**. A extensão abre o portal
   real. Com autofill dos dois campos e Turnstile aprovado legitimamente, o
   botão Entrar é acionado uma vez; sem autofill, o usuário confirma no portal.
   Depois da validação independente do catálogo pelo Render, volte ao RedeASSO
   e clique em **Concluir e entrar**.

A sessão obtida no Chrome ainda precisa ser aceita pelo portal numa consulta
feita pelo Render. Bloqueio de IP/Cloudflare resulta em recusa segura, nunca
em login fictício. Não contornar CAPTCHA, fingerprint ou segurança do portal.
Homologar transferência real, primeira consulta, logout e duração da sessão
antes de declarar a integração concluída. O código remoto anterior permanece
somente como fallback de desenvolvimento e não é iniciado por este deploy.

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

Antes do primeiro deploy desta versão, crie uma vez o bucket R2 usado pelas
fotos dos pisos:

```powershell
pnpm --filter @workspace/redeasso exec wrangler r2 bucket create redeasso-product-images
```

O vínculo `PRODUCT_IMAGES` com esse bucket já está versionado em
`wrangler.jsonc`. O Worker aceita JPG, PNG, WebP e AVIF de até 5 MB, exige uma
sessão válida para enviar ou remover arquivos e serve as imagens publicamente
em `/product-images/*`. A URL original importada continua preservada no banco
para histórico, mesmo quando a imagem exibida é substituída ou removida.

O Worker serve a SPA, as imagens do R2 e encaminha as demais rotas `/api/*` ao
Render. Isso faz com que sessão, CSRF e cookies permaneçam no mesmo domínio
Cloudflare, sem CORS permissivo.
O mesmo Worker executa um Cron Trigger `*/10 * * * *`, que faz uma chamada
`GET /api/healthz` ao Render. Esse ping não acessa dados de negócio, banco
nem sessões de usuários; ele também não executa a verificação de `DataSource`
do Actuator e, portanto, não mantém o Neon ativo sozinho.

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
3. Homologue o login externo conforme a seção 2.1. Entre também com as credenciais locais fortes configuradas no Render e execute uma
   leitura de pisos e uma alteração de mapa.
4. Confirme no Neon que migrations, sessões, pisos e mapas foram persistidos.
5. Registre um backup Neon e faça um ensaio de rollback antes de habilitar o
   uso operacional.

Não publique `admin/admin`, URL de banco, senha ou cookies no Git, no Worker
ou em variáveis `VITE_*`.
