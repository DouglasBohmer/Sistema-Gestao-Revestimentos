import { useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import {
  clearMapaCell,
  createMapa,
  deleteMapa,
  listMapas,
  updateMapa,
  updateMapaCell,
  useListPisos,
  type Mapa,
  type MapaCelula,
  type MapaCreateRequest,
  type MapaUpdateRequest,
  type Piso,
} from "@workspace/api-client-react"
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

const letra = (i: number) => String.fromCharCode(65 + i)

const pisosDaCelula = (celula?: MapaCelula[]): MapaCelula[] => celula ?? []

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

  const { data: mapas = [] } = useQuery<Mapa[]>({
    queryKey: ["mapas"],
    queryFn: () => listMapas(),
  })

  const mapa = mapas.find((m) => m.id === mapaAberto) ?? null

  const criarMutation = useMutation({
    mutationFn: (body: MapaCreateRequest) => createMapa(body),
    onSuccess: (novo) => {
      queryClient.invalidateQueries({ queryKey: ["mapas"] })
      setNovoOpen(false)
      setNome("")
      setMapaAberto(novo.id)
      toast({ title: "Mapa criado", description: `"${novo.nome}" (${novo.linhas}x${novo.colunas})` })
    },
    onError: (e: Error) => toast({ title: "Erro ao criar mapa", description: e.message, variant: "destructive" }),
  })

  const aplicarMapa = (atualizado: Mapa) =>
    queryClient.setQueryData<Mapa[]>(["mapas"], (old) =>
      (old ?? []).map((m) => (m.id === atualizado.id ? atualizado : m))
    )

  const atualizarMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: MapaUpdateRequest }) =>
      updateMapa(id, body),
    onSuccess: aplicarMapa,
    onError: (e: Error) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
  })

  const celulaMutation = useMutation({
    mutationFn: ({ id, pos, celula }: { id: number; pos: string; celula: MapaCelula[] | null }) =>
      celula
        ? updateMapaCell(id, pos, { pisos: celula })
        : clearMapaCell(id, pos),
    onSuccess: aplicarMapa,
    onError: (e: Error) => toast({ title: "Erro ao salvar posição", description: e.message, variant: "destructive" }),
  })

  const apagarMutation = useMutation({
    mutationFn: (id: number) => deleteMapa(id),
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
  mapa: Mapa
  onVoltar: () => void
  onSalvar: (body: MapaUpdateRequest) => void
  onSalvarCelula: (pos: string, celula: MapaCelula[] | null) => void
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

  const salvarCelula = (pos: string, celula: MapaCelula[] | null) => {
    onSalvarCelula(pos, celula)
    setPosSelecionada(null)
  }

  const pisosNaPosicao = (pos: string) =>
    pisosDaCelula(mapa.celulas[pos]).map((cel) => ({
      cel,
      piso: pisos.find((p) => p.id === cel.pisoId) ?? null,
    }))

  const labelInput = (key: keyof typeof labels, placeholder: string, className = "") => (
    <Input
      value={labels[key]}
      placeholder={placeholder}
      onChange={(e) => setLabels((l) => ({ ...l, [key]: e.target.value }))}
      onBlur={salvarLabels}
      className={`text-center border-2 border-black bg-white ${className}`}
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
                    const info = pisosNaPosicao(pos)
                    return (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => setPosSelecionada(pos)}
                        className={`rounded-md border-2 p-2 min-h-[90px] flex flex-col items-center justify-center text-center transition-colors ${
                          info.length > 0
                            ? "border-black bg-zinc-100 hover:bg-zinc-200"
                            : "border-zinc-400 bg-white hover:bg-zinc-100"
                        }`}
                      >
                        <span className="text-xs font-bold text-gray-400 mb-1">{pos}</span>
                        {info.length > 0 ? (
                          <div className="w-full space-y-1 text-left">
                            {info.map(({ cel, piso }) => (
                              <div key={cel.pisoId} className="rounded bg-white/70 px-2 py-1">
                                <p className="truncate text-xs font-semibold text-gray-800">
                                  {piso?.nome ?? `Piso #${cel.pisoId}`}
                                </p>
                                <p className="text-[11px] text-gray-600">
                                  {cel.m2} m² • {cel.caixas} cx
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-zinc-700">Adicionar pisos</span>
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
          celulas={pisosDaCelula(mapa.celulas[posSelecionada])}
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
  celulas,
  pisos,
  onClose,
  onSalvar,
}: {
  pos: string
  celulas: MapaCelula[]
  pisos: Piso[]
  onClose: () => void
  onSalvar: (celulas: MapaCelula[] | null) => void
}) {
  const { toast } = useToast()
  const [busca, setBusca] = useState("")
  const [pisosEmEdicao, setPisosEmEdicao] = useState(
    celulas.map((celula) => ({
      pisoId: celula.pisoId,
      m2: String(celula.m2),
      caixas: String(celula.caixas),
    }))
  )
  const [indiceSelecionando, setIndiceSelecionando] = useState<number | null>(
    celulas.length === 0 ? 0 : null
  )

  const filtrados = pisos.filter((p) => {
    const q = busca.toLowerCase()
    return (
      p.nome.toLowerCase().includes(q) ||
      (p.codigoLoja ?? "").toLowerCase().includes(q) ||
      (p.codigoRede ?? "").toLowerCase().includes(q)
    )
  })

  const selecionarPiso = (piso: Piso) => {
    if (indiceSelecionando === null) return

    setPisosEmEdicao((atual) => {
      const existente = atual[indiceSelecionando]
      let m2 = existente?.m2 ?? ""
      let caixas = existente?.caixas ?? ""
      const nM2 = parseFloat(m2)
      const nCaixas = parseFloat(caixas)

      if (piso.m2PorCaixa > 0 && !isNaN(nM2) && nM2 > 0) {
        caixas = String(Math.ceil(nM2 / piso.m2PorCaixa))
      } else if (piso.m2PorCaixa > 0 && !isNaN(nCaixas) && nCaixas > 0) {
        m2 = (nCaixas * piso.m2PorCaixa).toFixed(2)
      }

      const proximo = { pisoId: piso.id, m2, caixas }
      if (indiceSelecionando === atual.length) return [...atual, proximo]
      return atual.map((item, indice) => (indice === indiceSelecionando ? proximo : item))
    })
    setIndiceSelecionando(null)
    setBusca("")
  }

  const atualizarMedida = (indice: number, campo: "m2" | "caixas", valor: string) => {
    setPisosEmEdicao((atual) => atual.map((item, itemIndice) => {
      if (itemIndice !== indice) return item

      const piso = pisos.find((p) => p.id === item.pisoId)
      if (!piso || piso.m2PorCaixa <= 0) return { ...item, [campo]: valor }

      if (campo === "m2") {
        const m2 = parseFloat(valor)
        return {
          ...item,
          m2: valor,
          caixas: !valor ? "" : !isNaN(m2) && m2 > 0 ? String(Math.ceil(m2 / piso.m2PorCaixa)) : item.caixas,
        }
      }

      const caixas = parseFloat(valor)
      return {
        ...item,
        caixas: valor,
        m2: !valor ? "" : !isNaN(caixas) && caixas > 0 ? (caixas * piso.m2PorCaixa).toFixed(2) : item.m2,
      }
    }))
  }

  const removerPiso = (indice: number) => {
    setPisosEmEdicao((atual) => atual.filter((_, itemIndice) => itemIndice !== indice))
    setIndiceSelecionando(null)
  }

  const handleSalvar = () => {
    if (pisosEmEdicao.length === 0) {
      toast({ title: "Adicione pelo menos um piso", variant: "destructive" })
      return
    }

    const celulasParaSalvar: MapaCelula[] = []
    for (const item of pisosEmEdicao) {
      const nM2 = parseFloat(item.m2)
      const nCaixas = parseFloat(item.caixas)
      if ((isNaN(nM2) || nM2 <= 0) && (isNaN(nCaixas) || nCaixas <= 0)) {
        toast({ title: "Informe os m² ou a quantidade de caixas para cada piso", variant: "destructive" })
        return
      }
      celulasParaSalvar.push({
        pisoId: item.pisoId,
        m2: isNaN(nM2) ? 0 : nM2,
        caixas: isNaN(nCaixas) ? 0 : nCaixas,
      })
    }
    onSalvar(celulasParaSalvar)
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Posição {pos}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-md bg-zinc-100 px-3 py-2">
            <p className="text-sm font-medium text-zinc-700">{pisosEmEdicao.length} de 4 pisos adicionados</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pisosEmEdicao.length >= 4 || indiceSelecionando !== null}
              onClick={() => { setIndiceSelecionando(pisosEmEdicao.length); setBusca("") }}
            >
              <Plus size={16} className="mr-2" />
              Adicionar piso
            </Button>
          </div>

          {pisosEmEdicao.map((item, indice) => {
            const piso = pisos.find((p) => p.id === item.pisoId)
            return (
              <div key={`${item.pisoId}-${indice}`} className="space-y-3 rounded-md border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-800">Piso {indice + 1}: {piso?.nome ?? `Piso #${item.pisoId}`}</p>
                    <p className="text-xs text-gray-500">{piso?.codigoLoja ?? "Código indisponível"} • {piso?.m2PorCaixa ?? "-"} m²/caixa</p>
                  </div>
                  <div className="flex gap-1">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setIndiceSelecionando(indice); setBusca("") }}>
                      Trocar
                    </Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removerPiso(indice)} aria-label={`Remover piso ${indice + 1}`}>
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Metragem (m²)</Label>
                    <Input type="number" step="0.01" min="0" placeholder="Ex: 45.5" value={item.m2} onChange={(e) => atualizarMedida(indice, "m2", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Caixas</Label>
                    <Input type="number" step="1" min="0" placeholder="Ex: 10" value={item.caixas} onChange={(e) => atualizarMedida(indice, "caixas", e.target.value)} />
                  </div>
                </div>
              </div>
            )
          })}

          {indiceSelecionando !== null && (
            <div className="space-y-2 rounded-md border border-black p-4">
              <div className="flex items-center justify-between">
                <Label>{indiceSelecionando < pisosEmEdicao.length ? `Trocar piso ${indiceSelecionando + 1}` : "Selecionar novo piso"}</Label>
                <Button type="button" variant="ghost" size="sm" onClick={() => setIndiceSelecionando(null)}>Cancelar</Button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input placeholder="Buscar piso por nome ou código..." value={busca} onChange={(e) => setBusca(e.target.value)} className="pl-9" autoFocus />
              </div>
              <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {filtrados.length === 0 ? (
                  <p className="p-3 text-sm text-gray-500 text-center">Nenhum piso encontrado</p>
                ) : (
                  filtrados.map((piso) => {
                    const repetido = pisosEmEdicao.some((item, indice) => item.pisoId === piso.id && indice !== indiceSelecionando)
                    return (
                      <button
                        key={piso.id}
                        type="button"
                        disabled={repetido}
                        onClick={() => selecionarPiso(piso)}
                        className="w-full text-left p-3 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <p className="font-medium text-gray-800 text-sm">{piso.nome}</p>
                        <p className="text-xs text-gray-500">{piso.codigoLoja} • {piso.m2PorCaixa} m²/caixa</p>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500">Adicione até quatro pisos diferentes. Para cada um, informe os m² ou as caixas; o outro valor é calculado automaticamente.</p>
        </div>

        <DialogFooter className="gap-2">
          {celulas.length > 0 && (
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
