---
name: RedeASSO infra decisions
description: Decisões de infraestrutura do projeto RedeASSO — portas, workflows, Docker, backend.
---

## Arquitetura de workflows (solução final)

**"Start application"** — só Express:
```
cd frontend-gestao-revestimento && SERVER_PORT=3001 ./node_modules/.bin/tsx server/index.ts
```
waitForPort: 3001, outputType: **console** (nunca webview — se for webview na 3001, o preview pane do Replit passa a mostrar o Express, que responde "Cannot GET /" na raiz)

**"frontend-gestao-revestimento: web"** (artifact-managed, não pode ser removido) — só Vite:
```
pnpm --filter @workspace/redeasso run dev
```
Usa PORT=5000, BASE_PATH=/ de artifact.toml. Sobe na porta 5000 e proxeia /api → 3001.

**Por quê essa divisão:** quando ambos tentavam subir Vite+Express juntos, havia corrida de porta 5000. O artifact workflow sempre reinicia (não pode ser removido) e às vezes ganhava a porta, subindo Vite sem o Express — resultando em "Cannot GET /". A solução: deixar Express exclusivo no "Start application" e Vite exclusivo no artifact.

**O artifact.toml não pode ser editado diretamente** — o Edit tool rejeita. Não existe callback `updateArtifactToml`. Qualquer mudança no artifact.toml requer o "artifact TOML replacement flow" (mecanismo não disponível via ferramenta direta).

## Mapeamento de portas no .replit

O preview do Replit usa a porta externa **80**, que deve mapear para a **5000** (Vite). Se o `.replit` mapear 3001→80, o preview mostra o Express dev ("Cannot GET /"). `.replit` não pode ser editado direto — escrever TOML completo em arquivo temp e chamar `verifyAndReplaceDotReplit({ tempFilePath })`.

## Resolução de PORT no servidor Express

O servidor usa `SERVER_PORT ?? PORT ?? 3001`. Em dev usa SERVER_PORT=3001. Em Docker usa PORT=8080 (sem SERVER_PORT).

**Why:** Evita conflito com a var PORT do Vite (que também usa PORT para a porta do dev server).

## vite.config.ts obriga PORT e BASE_PATH

O arquivo lança erro se PORT ou BASE_PATH não estiver definido. O artifact.toml injeta ambos via `[services.env]`. Em Docker, definir explicitamente.

## Docker

- Build: `docker build -t redeasso:latest .`
- Run: `docker run -p 4545:8080 redeasso:latest`
- tsx em produção está em `frontend-gestao-revestimento/node_modules/.bin/tsx` (não no root node_modules).
- Express 5 usa `"/{*any}"` para catch-all — `"*"` quebra com path-to-regexp v8.

## Backend (Express em memória)

Arquivo: `frontend-gestao-revestimento/server/index.ts`
Dados em memória (sem DB). Reiniciar o servidor zera os dados.
