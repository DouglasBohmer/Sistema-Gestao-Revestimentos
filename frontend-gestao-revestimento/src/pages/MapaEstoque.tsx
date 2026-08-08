import { useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useListPisos, type Piso } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, ArrowLeft, Map as MapIcon, Search } from "lucide-react"

interface MapaCelula {
  pisoId: number
  m2: number
  caixas: number
}

interface MapaEstoqueData {
  id: number
  nome: string
  linhas: number
  colunas: number
  labels: { top: string; bottom: string; left: string; right: string }
  celulas: Record<string, MapaCelula>
  createdAt: string
  updatedAt: string
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.message ?? `Erro ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

const letra = (i: number) => String.fromCharCode(65 + i)

export default function MapaEstoque() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [mapaAberto, setMapaAberto] = useState<number | null>(null)
  const [novoOpen, setNovoOpen] = useState(false)
  const [apagarId, setApagarId] = useState<number | null>(null)

  // form novo mapa
  const [nome, setNome] = useState("")
  const [linhas, setLinhas] = useState("3")
  const [colunas, setColunas] = useState("4")

  const { data: mapas = [] } = useQuery<MapaEstoqueData[]>({
    queryKey: ["mapas"],
    queryFn: () => apiFetch("/api/mapas"),
  })

  const mapa = mapas.find((m) => m.id === mapaAberto) ?? null

  const criarMutation = useMutation({
    mutationFn: (body: object) =>
      apiFetch<MapaEstoqueData>("/api/mapas", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (novo) => {
      queryClient.invalidateQueries({ queryKey: ["mapas"] })
      setNovoOpen(false)
      setNome("")
      setMapaAberto(novo.id)
      toast({ title: "Mapa criado", description: `"${novo.nome}" (${novo.linhas}x${novo.colunas})` })
    },
    onError: (e: Error) => toast({ title: "Erro ao criar mapa", description: e.message, variant: "destructive" }),
  })

  const aplicarMapa = (atualizado: MapaEstoqueData) =>
    queryClient.setQueryData<MapaEstoqueData[]>(["mapas"], (old) =>
      (old ?? []).map((m) => (m.id === atualizado.id ? atualizado : m))
    )

  const atualizarMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: object }) =>
      apiFetch<MapaEstoqueData>(`/api/mapas/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    onSuccess: aplicarMapa,
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  })

  const celulaMutation = useMutation({
    mutationFn: ({ id, pos, celula }: { id: number; pos: string; celula: MapaCelula | null }) =>
      celula
        ? apiFetch<MapaEstoqueData>(`/api/mapas/${id}/celulas/${pos}`, { method: "PUT", body: JSON.stringify(celula) })
        : apiFetch<MapaEstoqueData>(`/api/mapas/${id}/celulas/${pos}`, { method: "DELETE" }),
    onSuccess: aplicarMapa,
    onError: (e: Error) => toast({ title: "Erro ao salvar posição", description: e.message, variant: "destructive" }),
  })

  const apagarMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/mapas/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapas"] })
      setApagarId(null)
      if (mapaAberto === apagarId) setMapaAberto(null)
      toast({ title: "Mapa apagado" })
    },
    onError: (e: Error) => toast({ title: "Erro ao apagar", description: e.message, variant: "destructive" }),
  })

  const handleCriar = (e: React.FormEvent) => {
    e.preventDefault()
    criarMutation.mutate({
      nome: nome.trim() || `Mapa ${mapas.length + 1}`,
      linhas: Number(linhas),
      colunas: Number(colunas),
    })
  }

  return (
    <Layout>
      <div className="p-8">
        {mapa ? (
          <MapaGrid
            mapa={mapa}
            onVoltar={() => setMapaAberto(null)}
            onSalvar={(body) => atualizarMutation.mutate({ id: mapa.id, body })}
            onSalvarCelula={(pos, celula) => celulaMutation.mutate({ id: mapa.id, pos, celula })}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Mapa Estoque</h1>
                <p className="text-gray-600">Mapas de localização dos pisos no estoque</p>
              </div>
              <Button onClick={() => setNovoOpen(true)}>
                <Plus size={18} className="mr-2" />
                Novo Mapa
              </Button>
            </div>

            {mapas.length === 0 ? (
              <Card className="border-none shadow-lg">
                <CardContent className="p-12 text-center text-gray-500">
                  <MapIcon className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                  Nenhum mapa criado ainda. Clique em "Novo Mapa" para começar.
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {mapas.map((m) => (
                  <Card key={m.id} className="border-none shadow-lg hover:shadow-xl transition-shadow cursor-pointer" onClick={() => setMapaAberto(m.id)}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">{m.nome}</h3>
                          <p className="text-sm text-gray-500 mt-1">
                            {m.linhas} x {m.colunas} — {Object.keys(m.celulas).length} posição(ões) preenchida(s)
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); setApagarId(m.id) }}
                        >
                          <Trash2 size={18} />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Novo mapa */}
        <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Mapa</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCriar} className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do mapa</Label>
                <Input placeholder="Ex: Galpão principal" value={nome} onChange={(e) => setNome(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Linhas (A, B, C...)</Label>
                  <Input type="number" min={1} max={26} value={linhas} onChange={(e) => setLinhas(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Colunas (1, 2, 3...)</Label>
                  <Input type="number" min={1} max={50} value={colunas} onChange={(e) => setColunas(e.target.value)} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={criarMutation.isPending}>Criar Mapa</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Confirmar apagar */}
        <AlertDialog open={apagarId !== null} onOpenChange={(o) => !o && setApagarId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apagar mapa?</AlertDialogTitle>
              <AlertDialogDescription>
                O mapa "{mapas.find((m) => m.id === apagarId)?.nome}" e todas as posições preenchidas serão removidos. Essa ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => apagarId !== null && apagarMutation.mutate(apagarId)}
              >
                Apagar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  )
}

// ─── Grid do mapa ────────────────────────────────────────────────────────────

function MapaGrid({
  mapa,
  onVoltar,
  onSalvar,
  onSalvarCelula,
}: {
  mapa: MapaEstoqueData
  onVoltar: () => void
  onSalvar: (body: Partial<MapaEstoqueData>) => void
  onSalvarCelula: (pos: string, celula: MapaCelula | null) => void
}) {
  const [labels, setLabels] = useState(mapa.labels)
  const [posSelecionada, setPosSelecionada] = useState<string | null>(null)

  const { data: pisosData } = useListPisos()
  const pisos: Piso[] = pisosData ?? []

  const salvarLabels = () => {
    if (JSON.stringify(labels) !== JSON.stringify(mapa.labels)) {
      onSalvar({ labels })
    }
  }

  const salvarCelula = (pos: string, celula: MapaCelula | null) => {
    onSalvarCelula(pos, celula)
    setPosSelecionada(null)
  }

  const pisoDaCelula = (pos: string) => {
    const cel = mapa.celulas[pos]
    if (!cel) return null
    return { cel, piso: pisos.find((p) => p.id === cel.pisoId) ?? null }
  }

  const labelInput = (key: keyof typeof labels, placeholder: string, className = "") => (
    <Input
      value={labels[key]}
      placeholder={placeholder}
      onChange={(e) => setLabels((l) => ({ ...l, [key]: e.target.value }))}
      onBlur={salvarLabels}
      className={`text-center border-2 border-green-600 bg-white ${className}`}
    />
  )

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={onVoltar}>
            <ArrowLeft size={18} />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{mapa.nome}</h1>
            <p className="text-sm text-gray-500">{mapa.linhas} x {mapa.colunas} — clique numa posição para adicionar ou editar um piso</p>
          </div>
        </div>
      </div>

      <Card className="border-none shadow-lg">
        <CardContent className="p-6 overflow-x-auto">
          <div className="min-w-fit space-y-3">
            {labelInput("top", "Observação (ex: Lado Parede)")}
            <div className="flex gap-3 items-stretch">
              <div className="flex items-center">
                {labelInput("left", "Obs.", "h-full w-14 [writing-mode:vertical-rl] py-2 px-1 min-h-[120px]")}
              </div>
              <div
                className="grid gap-3 flex-1"
                style={{ gridTemplateColumns: `repeat(${mapa.colunas}, minmax(110px, 1fr))` }}
              >
                {Array.from({ length: mapa.linhas }).flatMap((_, r) =>
                  Array.from({ length: mapa.colunas }).map((_, c) => {
                    const pos = `${letra(r)}${c + 1}`
                    const info = pisoDaCelula(pos)
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setPosSelecionada(pos)}
                        className={`rounded-md border-2 p-2 min-h-[90px] flex flex-col items-center justify-center text-center transition-colors ${
                          info
                            ? "border-[#980000] bg-red-50 hover:bg-red-100"
                            : "border-red-500 bg-white hover:bg-red-50"
                        }`}
                      >
                        <span className="text-xs font-bold text-gray-400 mb-1">{pos}</span>
                        {info ? (
                          <>
                            <span className="text-sm font-semibold text-gray-800 leading-tight">
                              {info.piso?.nome ?? `Piso #${info.cel.pisoId}`}
                            </span>
                            <span className="text-xs text-gray-600 mt-1">
                              {info.cel.m2} m² • {info.cel.caixas} cx
                            </span>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-red-600">Add Piso</span>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
              <div className="flex items-center">
                {labelInput("right", "Obs.", "h-full w-14 [writing-mode:vertical-rl] py-2 px-1 min-h-[120px]")}
              </div>
            </div>
            {labelInput("bottom", "Observação (ex: Lado Rua)")}
          </div>
        </CardContent>
      </Card>

      {posSelecionada && (
        <CelulaDialog
          pos={posSelecionada}
          celula={mapa.celulas[posSelecionada] ?? null}
          pisos={pisos}
          onClose={() => setPosSelecionada(null)}
          onSalvar={(cel) => salvarCelula(posSelecionada, cel)}
        />
      )}
    </>
  )
}

// ─── Dialog de posição ───────────────────────────────────────────────────────

function CelulaDialog({
  pos,
  celula,
  pisos,
  onClose,
  onSalvar,
}: {
  pos: string
  celula: MapaCelula | null
  pisos: Piso[]
  onClose: () => void
  onSalvar: (celula: MapaCelula | null) => void
}) {
  const { toast } = useToast()
  const [busca, setBusca] = useState("")
  const [pisoId, setPisoId] = useState<number | null>(celula?.pisoId ?? null)
  const [m2, setM2] = useState(celula ? String(celula.m2) : "")
  const [caixas, setCaixas] = useState(celula ? String(celula.caixas) : "")

  const piso = pisos.find((p) => p.id === pisoId) ?? null

  const filtrados = pisos.filter((p) => {
    const q = busca.toLowerCase()
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.codigoLoja ?? "").toLowerCase().includes(q) ||
      (p.codigoRede ?? "").toLowerCase().includes(q)
    )
  })

  const onM2Change = (v: string) => {
    setM2(v)
    const n = parseFloat(v)
    if (piso && piso.m2PorCaixa > 0 && !isNaN(n) && n > 0) {
      setCaixas(String(Math.ceil(n / piso.m2PorCaixa)))
    } else if (!v) {
      setCaixas("")
    }
  }

  const onCaixasChange = (v: string) => {
    setCaixas(v)
    const n = parseFloat(v)
    if (piso && piso.m2PorCaixa > 0 && !isNaN(n) && n > 0) {
      setM2((n * piso.m2PorCaixa).toFixed(2))
    } else if (!v) {
      setM2("")
    }
  }

  const selecionarPiso = (p: Piso) => {
    setPisoId(p.id)
    // recalcula com o m²/caixa do novo piso
    const nM2 = parseFloat(m2)
    if (p.m2PorCaixa > 0 && !isNaN(nM2) && nM2 > 0) {
      setCaixas(String(Math.ceil(nM2 / p.m2PorCaixa)))
    }
  }

  const handleSalvar = () => {
    const nM2 = parseFloat(m2)
    const nCaixas = parseFloat(caixas)
    if (!pisoId) {
      toast({ title: "Selecione um piso", variant: "destructive" })
      return
    }
    if ((isNaN(nM2) || nM2 <= 0) && (isNaN(nCaixas) || nCaixas <= 0)) {
      toast({ title: "Informe os m² ou a quantidade de caixas", variant: "destructive" })
      return
    }
    onSalvar({
      pisoId,
      m2: isNaN(nM2) ? 0 : nM2,
      caixas: isNaN(nCaixas) ? 0 : nCaixas,
    })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Posição {pos}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Piso</Label>
            {piso ? (
              <div className="flex items-center justify-between rounded-md border p-3 bg-gray-50">
                <div>
                  <p className="font-medium text-gray-800">{piso.nome}</p>
                  <p className="text-xs text-gray-500">
                    {piso.codigoLoja} • {piso.m2PorCaixa} m²/caixa
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setPisoId(null)}>Trocar</Button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Buscar piso por nome ou código..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                  {filtrados.length === 0 ? (
                    <p className="p-3 text-sm text-gray-500 text-center">Nenhum piso encontrado</p>
                  ) : (
                    filtrados.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => selecionarPiso(p)}
                        className="w-full text-left p-3 hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-800 text-sm">{p.nome}</p>
                        <p className="text-xs text-gray-500">
                          {p.codigoLoja} • {p.m2PorCaixa} m²/caixa
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Metragem (m²)</Label>
              <Input type="number" step="0.01" min="0" placeholder="Ex: 45.5" value={m2} onChange={(e) => onM2Change(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Caixas</Label>
              <Input type="number" step="1" min="0" placeholder="Ex: 10" value={caixas} onChange={(e) => onCaixasChange(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-gray-500">Preencha um dos campos — o outro é calculado automaticamente pelo m²/caixa do piso.</p>
        </div>

        <DialogFooter className="gap-2">
          {celula && (
            <Button variant="destructive" onClick={() => onSalvar(null)}>
              <Trash2 size={16} className="mr-2" />
              Limpar posição
            </Button>
          )}
          <Button onClick={handleSalvar}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
