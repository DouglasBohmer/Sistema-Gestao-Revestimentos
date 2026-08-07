---
name: RedeASSO infra decisions
description: Decisões de infraestrutura do projeto RedeASSO — portas, workflows, Docker, backend.
---

## Porta e preview do Replit

O Replit webview exige porta **5000**. O workflow correto é `Start application` (outputType: webview, waitForPort: 5000).

O artifact gera automaticamente um workflow paralelo `frontend-gestao-revestimento: web` que compete na porta. Ele **não pode ser removido** (é gerenciado pelo artifact). Quando ele acordar e ocupar a porta 5000 antes do "Start application", basta rodar:
```js
await stopWorkflow({ name: "frontend-gestao-revestimento: web" });
await restartWorkflow({ workflowName: "Start application" });
```

**Why:** O artifact.toml define localPort=5000 mas o workflow do artifact não é webview, então o preview fica em branco. O "Start application" é o que mostra o app.

## Comando do workflow "Start application"

```
cd frontend-gestao-revestimento && SERVER_PORT=3001 ./node_modules/.bin/tsx server/index.ts & sleep 1 && PORT=5000 BASE_PATH=/ pnpm --filter @workspace/redeasso run dev
```

Roda o Express na 3001, Vite na 5000 com proxy `/api` → 3001.

**Why:** Vite não tem backend; Express serve a API. Proxy configurado em vite.config.ts server.proxy.

## Resolução de PORT no servidor Express

O servidor usa `SERVER_PORT ?? PORT ?? 3001`. Em dev usa SERVER_PORT=3001. Em Docker usa PORT=8080 (sem SERVER_PORT).

**Why:** Evita conflito com a var PORT do Vite (que também usa PORT para a porta do dev server).

## Docker

- Build: `docker build -t redeasso:latest .`  
- Run: `docker run -p 4545:8080 redeasso:latest`  
- tsx em produção está em `frontend-gestao-revestimento/node_modules/.bin/tsx` (não no root node_modules).
- Express 5 usa `"/{*any}"` para catch-all — `"*"` quebra com path-to-regexp v8.

**Why:** tsx é devDep do workspace frontend, não do root. Express 5 mudou a sintaxe de wildcard.

## Backend (Express em memória)

Arquivo: `frontend-gestao-revestimento/server/index.ts`  
Dados em memória (sem DB). Reiniciar o servidor zera os dados.

Se quiser persistência: adicionar DATABASE_URL e usar o lib/db (Drizzle + PostgreSQL) que já existe.
