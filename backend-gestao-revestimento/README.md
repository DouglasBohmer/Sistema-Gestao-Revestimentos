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

## Área Central e CAPTCHA

O login externo é assistido. Ao escolhê-lo no RedeASSO, o Spring abre um Chrome
isolado no contêiner Selenium; o operador abre o noVNC, informa sua conta da
Área Central e resolve o CAPTCHA manualmente. Ao confirmar no RedeASSO, o
Spring coleta o cookie jar apenas na memória do processo, vinculado à sessão
atual. Senhas e cookies externos não são devolvidos ao React, não vão para o
PostgreSQL e não sobrevivem ao reinício da aplicação.

O navegador não faz parte do Compose padrão. Para habilitá-lo localmente,
copie `.env.example` para `.env`, defina uma senha forte e execute a partir da
raiz do repositório:

```powershell
$env:AREA_CENTRAL_VNC_PASSWORD = "uma-senha-forte-e-exclusiva"
$env:AREA_CENTRAL_INTERACTIVE_URL = "http://localhost:7900/?autoconnect=1&resize=scale"
docker compose -f docker-compose.yml -f docker-compose.area-central.yml up -d --build
```

No servidor, publique a porta 7900 somente no IP Tailscale da máquina e use a
URL MagicDNS correspondente em `AREA_CENTRAL_INTERACTIVE_URL`. Não use Funnel
para essa porta. A janela noVNC pedirá a senha definida em
`AREA_CENTRAL_VNC_PASSWORD`; ela não é enviada pela API nem incluída no link.

O contêiner aceita somente uma tentativa de login interativo por vez. Uma
tentativa expira em dez minutos, pode ser cancelada pela interface e fecha o
navegador remoto. Não há resolução ou contorno automático de CAPTCHA.
