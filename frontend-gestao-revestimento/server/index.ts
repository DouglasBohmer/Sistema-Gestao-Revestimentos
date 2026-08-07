import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.resolve(__dirname, "../dist/public");

const app = express();
app.use(express.json());

const PORT = Number(process.env.SERVER_PORT ?? process.env.PORT ?? 3001);

// ─── In-memory stores ───────────────────────────────────────────────────────

interface Piso {
  id: number;
  nome: string;
  codigoRede: string | null;
  codigoLoja: string;
  largura: number | null;
  altura: number | null;
  rejunte: number | null;
  pecasPorCaixa: number | null;
  m2PorCaixa: number;
  localDeUso: string | null;
  tipoPiso: string | null;
  pei: number | null;
  retificado: boolean | null;
  linkSite: string | null;
  linkFoto: string | null;
  valor: number | null;
  createdAt: string;
  updatedAt: string | null;
}

interface Atividade {
  id: number;
  tipo: string;
  descricao: string;
  pisoNome: string | null;
  createdAt: string;
}

let pisosSeq = 1;
let atividadesSeq = 1;

const pisos: Piso[] = [
  {
    id: pisosSeq++,
    nome: "Portinari Cimento Bold",
    codigoRede: "PTC-001",
    codigoLoja: "L-001",
    largura: 60,
    altura: 60,
    rejunte: 2,
    pecasPorCaixa: 4,
    m2PorCaixa: 1.44,
    localDeUso: "Interno",
    tipoPiso: "Porcelanato",
    pei: 4,
    retificado: true,
    linkSite: null,
    linkFoto: null,
    valor: 89.9,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
  {
    id: pisosSeq++,
    nome: "Elizeu Rustic Bege",
    codigoRede: "ELZ-002",
    codigoLoja: "L-002",
    largura: 45,
    altura: 45,
    rejunte: 3,
    pecasPorCaixa: 6,
    m2PorCaixa: 1.215,
    localDeUso: "Externo",
    tipoPiso: "Cerâmica",
    pei: 3,
    retificado: false,
    linkSite: null,
    linkFoto: null,
    valor: 42.5,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  },
];

const atividades: Atividade[] = [
  {
    id: atividadesSeq++,
    tipo: "cadastro",
    descricao: "Piso Portinari Cimento Bold cadastrado",
    pisoNome: "Portinari Cimento Bold",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: atividadesSeq++,
    tipo: "cadastro",
    descricao: "Piso Elizeu Rustic Bege cadastrado",
    pisoNome: "Elizeu Rustic Bege",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

function addAtividade(tipo: string, descricao: string, pisoNome?: string) {
  atividades.unshift({
    id: atividadesSeq++,
    tipo,
    descricao,
    pisoNome: pisoNome ?? null,
    createdAt: new Date().toISOString(),
  });
  if (atividades.length > 50) atividades.pop();
}

// ─── Routes ─────────────────────────────────────────────────────────────────

app.get("/api/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

// LIST pisos
app.get("/api/pisos", (req, res) => {
  const { search, localDeUso, tipoPiso } = req.query as Record<string, string | undefined>;
  let result = [...pisos];
  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        (p.codigoRede ?? "").toLowerCase().includes(q) ||
        p.codigoLoja.toLowerCase().includes(q)
    );
  }
  if (localDeUso) result = result.filter((p) => p.localDeUso === localDeUso);
  if (tipoPiso) result = result.filter((p) => p.tipoPiso === tipoPiso);
  res.json(result);
});

// CREATE piso
app.post("/api/pisos", (req, res) => {
  const body = req.body;
  if (!body.nome || !body.codigoLoja || !body.m2PorCaixa) {
    return res.status(400).json({ error: "nome, codigoLoja e m2PorCaixa são obrigatórios" });
  }
  const novo: Piso = {
    id: pisosSeq++,
    nome: body.nome,
    codigoRede: body.codigoRede ?? null,
    codigoLoja: body.codigoLoja,
    largura: body.largura ?? null,
    altura: body.altura ?? null,
    rejunte: body.rejunte ?? null,
    pecasPorCaixa: body.pecasPorCaixa ?? null,
    m2PorCaixa: Number(body.m2PorCaixa),
    localDeUso: body.localDeUso ?? null,
    tipoPiso: body.tipoPiso ?? null,
    pei: body.pei ?? null,
    retificado: body.retificado ?? null,
    linkSite: body.linkSite ?? null,
    linkFoto: body.linkFoto ?? null,
    valor: body.valor ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: null,
  };
  pisos.push(novo);
  addAtividade("cadastro", `Piso ${novo.nome} cadastrado`, novo.nome);
  return res.status(201).json(novo);
});

// GET piso by ID
app.get("/api/pisos/:id", (req, res) => {
  const piso = pisos.find((p) => p.id === Number(req.params.id));
  if (!piso) return res.status(404).json({ error: "Piso não encontrado" });
  return res.json(piso);
});

// GET piso by código
app.get("/api/pisos/codigo/:codigo", (req, res) => {
  const codigo = req.params.codigo;
  const piso = pisos.find(
    (p) => p.codigoLoja === codigo || p.codigoRede === codigo
  );
  if (!piso) return res.status(404).json({ error: "Piso não encontrado" });
  return res.json(piso);
});

// UPDATE piso
app.put("/api/pisos/:id", (req, res) => {
  const idx = pisos.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Piso não encontrado" });
  const body = req.body;
  pisos[idx] = {
    ...pisos[idx],
    ...body,
    id: pisos[idx].id,
    createdAt: pisos[idx].createdAt,
    updatedAt: new Date().toISOString(),
  };
  addAtividade("cadastro", `Piso ${pisos[idx].nome} atualizado`, pisos[idx].nome);
  return res.json(pisos[idx]);
});

// DELETE piso
app.delete("/api/pisos/:id", (req, res) => {
  const idx = pisos.findIndex((p) => p.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: "Piso não encontrado" });
  const [removed] = pisos.splice(idx, 1);
  addAtividade("cadastro", `Piso ${removed.nome} excluído`, removed.nome);
  return res.status(204).send();
});

// CALCULAR
app.post("/api/pisos/calcular", (req, res) => {
  const { codigoPiso, metragemM2, margemQuebra = 10 } = req.body;
  if (!codigoPiso || !metragemM2) {
    return res.status(400).json({ error: "codigoPiso e metragemM2 são obrigatórios" });
  }
  const piso = pisos.find(
    (p) => p.codigoLoja === codigoPiso || p.codigoRede === codigoPiso
  );
  if (!piso) return res.status(404).json({ error: "Piso não encontrado" });

  const margem = Number(margemQuebra) / 100;
  const metragemComMargem = Number(metragemM2) * (1 + margem);
  const quantidadeCaixas = Math.ceil(metragemComMargem / piso.m2PorCaixa);
  const valorTotal = piso.valor != null ? quantidadeCaixas * piso.valor : null;

  addAtividade("calculo", `Cálculo realizado para ${piso.nome} (${metragemM2} m²)`, piso.nome);

  return res.json({
    piso,
    metragemM2: Number(metragemM2),
    margemQuebra: Number(margemQuebra),
    metragemComMargem,
    quantidadeCaixas,
    valorTotal,
  });
});

// DASHBOARD STATS
app.get("/api/dashboard/stats", (_req, res) => {
  const calculosRealizados = atividades.filter((a) => a.tipo === "calculo").length;
  const totalImpressoes = atividades.filter((a) => a.tipo === "impressao").length;
  res.json({
    totalPisos: pisos.length,
    calculosRealizados,
    totalImpressoes,
    estoqueDisponivel: pisos.length,
  });
});

// ATIVIDADES RECENTES
app.get("/api/dashboard/atividade-recente", (_req, res) => {
  res.json(atividades.slice(0, 10));
});

// PISOS POR TIPO
app.get("/api/dashboard/pisos-por-tipo", (_req, res) => {
  const map: Record<string, number> = {};
  for (const p of pisos) {
    const tipo = p.tipoPiso ?? "Outros";
    map[tipo] = (map[tipo] ?? 0) + 1;
  }
  const result = Object.entries(map).map(([tipo, total]) => ({ tipo, total }));
  res.json(result);
});

// ─── Static files (produção) ─────────────────────────────────────────────────

if (process.env.NODE_ENV === "production") {
  app.use(express.static(STATIC_DIR));
  // SPA fallback — qualquer rota que não seja /api retorna o index.html
  app.get("/{*any}", (_req, res) => {
    res.sendFile(path.join(STATIC_DIR, "index.html"));
  });
}

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[server] Rodando em http://localhost:${PORT} (${process.env.NODE_ENV ?? "development"})`);
});
