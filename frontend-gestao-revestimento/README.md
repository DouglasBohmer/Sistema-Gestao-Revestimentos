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
Consome a API REST Spring Boot pelo cliente gerado a partir do OpenAPI. Em desenvolvimento, o Vite encaminha `/api` para o Spring em `localhost:8080`; na imagem Docker, React e API são servidos pelo Spring no mesmo endereço.
