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

### 2.1 Habilitar o navegador assistido da Área Central

Decisão de 15/10/2026: existe **somente `redeasso-api` no Render**. Não retome
nem crie `redeasso-area-central-browser`. Docker da loja/Tailscale não é mais
uma dependência de produção. Neon e Cloudflare permanecem inalterados.

1. Sincronize o Blueprint existente, sem criar outro serviço. Em **Settings /
   Build & Deploy**, confirme:

   | Campo | Valor |
   | --- | --- |
   | Root Directory | vazio (raiz do repositório) |
   | Dockerfile Path | `backend-gestao-revestimento/Dockerfile.render` |
   | Docker Build Context Directory | `.` (raiz do repositório) |
   | Docker Command | vazio (usa o entrypoint da imagem) |
   | Health Check Path | `/api/healthz` |

   O contexto antigo `backend-gestao-revestimento` não inclui os arquivos
   `infra/area-central-browser` e fará o build falhar. O workflow Docker também
   valida a imagem Render usando o contexto da raiz.

2. Confirme as variáveis `REDEASSO_INTEGRATION_AREA_CENTRAL_ENABLED=true`,
   `AREA_CENTRAL_ALLOWED_FRAME_ORIGIN=https://redeasso.assocom.workers.dev` e
   `AREA_CENTRAL_READ_TIMEOUT=90s`. O entrypoint deriva a URL interativa de
   `RENDER_EXTERNAL_URL`, ficando em `https://redeasso-api.onrender.com/vnc.html`.
   Ele configura automaticamente o gateway interno em loopback e compartilha
   as chaves transitórias entre Spring e gateway. Não precisa parear segredos
   com outro serviço. URLs antigas de Funnel ou do navegador suspenso não são
   usadas por esse runtime.

3. Garanta que `AREA_CENTRAL_SESSION_ENCRYPTION_KEY` está configurada e não
   mude entre deploys. Para configuração manual, gere uma vez no PowerShell
   e cole o resultado **somente no segredo do Render**, nunca no Git:

   ```powershell
   $sessionKeyBytes = New-Object byte[] 32
   $sessionKeyRng = [Security.Cryptography.RandomNumberGenerator]::Create()
   $sessionKeyRng.GetBytes($sessionKeyBytes)
   [Convert]::ToBase64String($sessionKeyBytes)
   $sessionKeyRng.Dispose()
   [Array]::Clear($sessionKeyBytes, 0, $sessionKeyBytes.Length)
   ```

   A senha do portal nunca é persistida. Apenas cookies externos são
   criptografados com AES-GCM no Spring Session JDBC/Neon, com validade
   absoluta de até 12 horas. Logout e expiração removem o envelope. Sem a
   chave, o fallback em memória não sobrevive a um reinício da API.

4. Publique a `main`. O gateway escuta a porta pública e encaminha `/api/*`
   e Actuator para Spring em loopback. Chromium/Xvfb/VNC/noVNC iniciam somente
   numa tentativa de login e encerram após captura dos cookies, cancelamento
   ou dez minutos. Sem login em andamento, esses processos não ficam ativos.
   `/api/healthz` não inicia Chrome nem consulta o banco.

5. Na tela RedeASSO, informe usuário e senha e clique em **Entrar**. O formulário
   real é preenchido; o gateway espera o próprio portal liberar o botão e
   produzir uma resposta válida do Turnstile. Só então submete uma vez. Não
   há clique automatizado no CAPTCHA, callback forçado ou token fabricado.
   Se precisar de intervenção, o modal mostra a página real no mesmo app.

6. Homologue com conta autorizada: entrada automática quando aprovada pelo
   portal, modal quando solicitado, senha incorreta, cancelamento, logout,
   primeira consulta ao catálogo, reabertura do navegador e novo deploy com
   a mesma chave. Monitore memória no Render durante o login. O processo
   enxuto e sob demanda reduz consumo, mas **não comprova** que Chromium +
   Spring caberão nos 512 MB do Free nem garante aprovação do Turnstile.
   O sandbox do Chromium permanece habilitado. Se o ambiente não permitir
   iniciá-lo, não desabilite proteções automaticamente. Se faltar memória ou
   o portal rejeitar o navegador, registre o diagnóstico
   e discuta a alternativa antes de trocar plano/topologia.

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
