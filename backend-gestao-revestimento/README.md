# Backend RedeASSO

Backend definitivo do RedeASSO em Java 21 e Spring Boot. Não existe servidor
Node/Express no runtime: em produção, o próprio Spring serve a API e o bundle
React no mesmo endereço.

## Estrutura

O código usa pacotes por domínio:

- `auth`: sessão e autenticação do RedeASSO;
- `integracao.areacentral`: fronteira da integração externa, ainda sem automatizar o login;
- `catalogo`, `calculo`, `mapa`, `orcamento`, `snapshot`, `etiqueta`, `auditoria` e `configuracao`: módulos da migração;
- `shared`: componentes técnicos compartilhados, quando necessários.

O PostgreSQL é versionado por migrations Flyway. O Hibernate somente valida o schema (`ddl-auto=validate`) e não o cria nem o altera.

## Pré-requisitos

- Java 21;
- Docker Desktop, apenas para o PostgreSQL local;
- PowerShell no Windows.

Não é necessário instalar Maven globalmente: o Maven Wrapper está configurado no projeto.

## Desenvolvimento local

No diretório `backend-gestao-revestimento`:

```powershell
docker compose -f compose.dev.yml up -d
.\mvnw.cmd spring-boot:run
```

O perfil padrão é `local`. A API abre em `http://localhost:8080` e o health check da fundação fica em `GET /api/healthz`.

Para desenvolver o frontend com recarregamento automático, execute em outro
terminal, a partir de `frontend-gestao-revestimento`:

```powershell
$env:PORT=5000
$env:BASE_PATH="/"
$env:VITE_API_PROXY_TARGET="http://localhost:8080"
pnpm.cmd dev
```

O Vite encaminha `/api` para o Spring. O Express não é necessário.

As credenciais temporárias `admin/admin` podem ser substituídas pelas variáveis
`REDEASSO_LOCAL_ADMIN_USERNAME` e `REDEASSO_LOCAL_ADMIN_PASSWORD`.

Para parar apenas a aplicação, interrompa o Maven com `Ctrl+C`. Para parar o PostgreSQL sem excluir seus dados:

```powershell
docker compose -f compose.dev.yml stop
```

Não execute `down -v` se quiser preservar o banco local.

## Aplicação completa em Docker

Na raiz do repositório, copie `.env.example` para `.env`, defina uma senha
forte para o PostgreSQL e execute:

```powershell
docker compose up -d --build
docker compose ps
```

O build compila o React com pnpm, incorpora os arquivos estáticos ao JAR,
compila/testa o Spring com Java 21 e produz uma imagem final somente com o JRE.
O serviço usa o perfil `prod`, executa as migrations Flyway ao iniciar e aguarda
o health check do PostgreSQL. Os dados ficam no volume nomeado
`redeasso-postgres`.

O Compose mantém o acesso local de teste habilitado por padrão. Altere
`REDEASSO_LOCAL_ADMIN_PASSWORD` ou defina `REDEASSO_LOCAL_ADMIN_ENABLED=false`
antes de qualquer exposição externa; ele não substitui uma sessão da Área
Central para consultas externas.

Por padrão, a porta é publicada apenas em `127.0.0.1:8080`, apropriado para
um proxy local ou Tailscale Serve atuando no host. Não use Funnel enquanto o
admin temporário estiver ativo. Para acesso direto por outro dispositivo
da tailnet, defina conscientemente `APP_BIND_ADDRESS=0.0.0.0` no `.env` e mantenha
as regras de firewall restritas à rede Tailscale.

Não execute `docker compose down -v` no servidor ou no fallback local: essa
opção remove o volume do PostgreSQL.

## Testes

Testes rápidos, sem depender de um banco instalado:

```powershell
.\mvnw.cmd test
```

Validação de integração com PostgreSQL descartável via Testcontainers:

```powershell
.\mvnw.cmd verify -Pintegration
```

O segundo comando exige que o Docker esteja ativo. Nenhum teste acessa a Área Central ou usa uma conta real.

## Configuração

As variáveis principais estão documentadas em `.env.example`. O arquivo é apenas um modelo; segredos reais não devem ser versionados.

Em produção, o Compose ativa `SPRING_PROFILES_ACTIVE=prod`, configura a conexão
interna com o PostgreSQL e mantém o cookie de sessão seguro por padrão. Para o
fallback local acessado diretamente por HTTP, `SESSION_COOKIE_SECURE=false` pode
ser usado apenas naquele ambiente.

## Produção: Neon + Render

O único serviço Render (`redeasso-api`) executa Spring e o gateway usando
[`Dockerfile.render`](Dockerfile.render); a SPA é publicada separadamente no
Cloudflare Workers. O contexto Docker é a **raiz do repositório**. O navegador
gráfico é um subprocesso sob demanda no mesmo contêiner. O arquivo [`../render.yaml`](../render.yaml) descreve o
serviço `redeasso-api` e o Render faz deploy automático da `main` depois que os
checks do GitHub passarem.

Crie o banco no Neon e use a conexão **direta** para esta primeira instância
Spring/Flyway. O pooler do Neon usa pooling por transação, que restringe
recursos de sessão que ferramentas de migração podem necessitar. No Render,
configure estes segredos:

- `DATABASE_URL`: URL JDBC sem usuário/senha, por exemplo
  `jdbc:postgresql://ep-exemplo.us-east-2.aws.neon.tech/neondb?sslmode=require`;
- `DATABASE_USERNAME` e `DATABASE_PASSWORD`: extraídos da conexão Neon;
- `REDEASSO_LOCAL_ADMIN_USERNAME` e `REDEASSO_LOCAL_ADMIN_PASSWORD`: fortes e
  exclusivos enquanto o acesso local de apoio existir.

Mantenha `SESSION_COOKIE_SECURE=true` e `SESSION_COOKIE_SAME_SITE=lax`. O
Cloudflare Worker encaminha `/api/*` no mesmo domínio público e preserva os
cabeçalhos de sessão; não é necessário liberar CORS para origens arbitrárias.
Em produção, `SESSION_CLEANUP_CRON=0 0 6 * * *` limpa sessões JDBC expiradas
uma vez ao dia, às 06:00 UTC (03:00 em Brasília). O padrão por minuto do Spring
Session não deve ser usado com Neon autosuspend.

Na primeira inicialização, o Flyway cria o schema no Neon. A migração dos dados
locais deve ocorrer somente depois de confirmar backup e banco Neon vazio.
Não aponte uma prévia de branch para o banco de produção.

## Área Central e CAPTCHA

O usuário informa login e senha no RedeASSO. O Spring os encaminha somente
para preencher o formulário real do portal no Chromium isolado. O gateway
espera o próprio portal aprovar o Turnstile e liberar o botão, então envia uma
única vez. O CAPTCHA não é clicado/resolvido por automação. No modo de observação
atual, o modal noVNC sempre abre na mesma tela, sem nova guia. Ele permanece
visível inclusive nos erros; após reconhecer o login, o app aguarda o botão
“Concluir e entrar” para capturar a sessão e fechar o navegador.
Se o preenchimento automático falhar após abrir a página, ela é preservada
para inspeção/interação manual. Uma falha ao iniciar o serviço ainda pode
impedir a exibição; nesse caso o modal apresenta diagnóstico sem HTML bruto.
A senha não é persistida, devolvida ou registrada em logs.

Configure `AREA_CENTRAL_SESSION_ENCRYPTION_KEY` com 32 bytes aleatórios em
Base64, estáveis entre deploys. O cookie jar fica em envelope AES-GCM na sessão
JDBC/Neon, ligado ao ID da sessão e com validade absoluta de até 12 horas.
`SESSION_COOKIE_MAX_AGE=12h` permite reabrir o navegador durante esse período.
A expiração do portal pode exigir novo login antes. Sem a chave, apenas o
fallback volátil em memória fica disponível. Nenhum cookie externo vai ao React.

O navegador não faz parte do Compose padrão. Para habilitá-lo localmente,
copie `.env.example` para `.env`, defina dois segredos diferentes com pelo
menos 32 caracteres e execute a partir da raiz do repositório:

```powershell
$env:AREA_CENTRAL_BROWSER_SERVICE_KEY = "chave-interna-aleatoria-e-exclusiva"
$env:AREA_CENTRAL_INTERACTIVE_TOKEN_SECRET = "segredo-hmac-aleatorio-e-exclusivo"
docker compose -f docker-compose.yml -f docker-compose.area-central.yml up -d --build
```

O gateway local publica apenas a porta configurada em
`AREA_CENTRAL_BROWSER_PORT` (padrão `7900`). Ele mantém Chrome DevTools na
porta 9222 e noVNC na 7900 internamente, exigindo a chave interna do Spring e
um token HMAC curto por tentativa antes de encaminhar qualquer websocket. Para
usar o Vite local, defina `AREA_CENTRAL_ALLOWED_FRAME_ORIGIN=http://localhost:5000`.

O contêiner aceita somente uma tentativa de login interativo por vez. Uma
tentativa expira em dez minutos, pode ser cancelada pela interface e fecha o
navegador remoto. Não há resolução ou contorno automático de CAPTCHA.

Em produção, não crie outro serviço nem retome o antigo navegador suspenso.
O entrypoint Render gera/compartilha as chaves internas entre Spring e gateway
e usa `RENDER_EXTERNAL_URL` para o modal. Chromium, Xvfb, VNC e noVNC iniciam
somente ao abrir a tentativa e encerram ao concluir, cancelar ou expirar. O
health check `/api/healthz` não inicia navegador nem consulta o Neon. A memória
durante o login e a aprovação real do Turnstile ainda exigem homologação.
O roteiro completo está em [`../docs/DEPLOY_NEON_RENDER_CLOUDFLARE.md`](../docs/DEPLOY_NEON_RENDER_CLOUDFLARE.md).
