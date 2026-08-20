# RedeASSO — Frontend Web

Frontend React + Vite do Sistema de Gestão de Revestimentos Cerâmicos (Casa dos Tubos).

## Stack
- React 19 + TypeScript
- Vite
- Tailwind CSS v4
- shadcn/ui
- TanStack Query
- Wouter (roteamento)
- Recharts (gráficos)

## Telas
- **Início** — métricas, atalhos rápidos e atividades recentes
- **Cadastro** — CRUD completo de pisos com preview de imagem
- **Calcular** — cálculo de caixas, argamassa e rejunte + orçamento via WhatsApp
- **Mapa Estoque** — mapas persistentes com até quatro pisos por posição

## Rodar localmente
```powershell
$env:PORT=5000
$env:BASE_PATH="/"
$env:VITE_API_PROXY_TARGET="http://localhost:8080"
pnpm.cmd dev
```

## API
Consome a API REST Spring Boot pelo cliente gerado a partir do OpenAPI. Em
desenvolvimento, o Vite encaminha `/api` para o Spring em `localhost:8080`.
No fallback Docker, React e API continuam no mesmo endereço.

## Cloudflare Workers

Em produção, a SPA é servida por um Worker com assets estáticos. O mesmo Worker
encaminha apenas `/api/*` ao Spring no Render. Para o navegador, frontend e API
continuam no mesmo domínio, portanto a sessão HTTP e CSRF não dependem de
cookies de terceiros nem de CORS aberto.

Para testar localmente o Worker, copie `.dev.vars.example` para `.dev.vars` e
execute:

```powershell
pnpm.cmd --filter @workspace/redeasso run build
pnpm.cmd --filter @workspace/redeasso run dev:cloudflare
```

No Cloudflare Workers Builds, configure:

- diretório raiz: `frontend-gestao-revestimento`;
- comando de build: `corepack enable && corepack prepare pnpm@11.21.0 --activate && pnpm install --frozen-lockfile && pnpm run typecheck && pnpm run build`;
- comando de deploy: `pnpm exec wrangler deploy --config wrangler.jsonc`;
- variável de runtime `API_ORIGIN`: URL HTTPS do serviço Render, sem barra final.

Não habilite previews do Worker apontando para a API/dados de produção. Quando
houver um ambiente de homologação com banco Neon próprio, configure uma
`API_ORIGIN` de preview para ele.
