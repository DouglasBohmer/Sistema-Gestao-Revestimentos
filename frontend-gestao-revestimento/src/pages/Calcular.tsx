import { useState } from "react"
import { Layout } from "@/components/layout/Layout"
import { useCalcularPiso, type CalculoResult } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Search, MessageCircle, Package, Layers, Box, Plus } from "lucide-react"

export default function Calcular() {
  const { toast } = useToast()
  
  const [codigoBusca, setCodigoBusca] = useState("")
  
  const [metragem, setMetragem] = useState<string>("")
  const [telefone, setTelefone] = useState<string>("")
  const [valorM2, setValorM2] = useState<string>("")
  const [margem] = useState<string>("10")

  const [resultado, setResultado] = useState<CalculoResult | null>(null)
  const piso = resultado?.piso ?? null

  const calcularMutation = useCalcularPiso()

  const handleCalcular = (e: React.FormEvent) => {
    e.preventDefault()

    const codigo = codigoBusca.trim()
    if (!codigo) {
      toast({ title: "Erro", description: "Informe o código do piso.", variant: "destructive" })
      return
    }
    
    const m2 = parseFloat(metragem)
    
    if (isNaN(m2) || m2 <= 0) {
      toast({ title: "Erro", description: "Informe uma metragem válida.", variant: "destructive" })
      return
    }

    setResultado(null)
    calcularMutation.mutate(
      { data: { codigoPiso: codigo, metragemM2: m2, margemQuebra: parseFloat(margem) } },
      {
        onSuccess: (data) => {
          setResultado(data)
          setValorM2(data.piso.valor?.toString() ?? "")
        },
        onError: () => {
          toast({ title: "Erro", description: "Piso não encontrado ou dados inválidos.", variant: "destructive" })
        }
      }
    )
  }

  const handleWhatsApp = () => {
    if (!resultado || !piso) return
    
    const msg = `Olá! Gostaria de um orçamento:\n\nCódigo: ${piso.codigoLoja}\nÁrea: ${metragem}m²\nCaixas necessárias: ${resultado.quantidadeCaixas}\n${resultado.valorTotal ? `Valor: R$ ${resultado.valorTotal.toFixed(2)}` : ''}`
    
    const phone = telefone.replace(/\D/g, '')
    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <Layout>
      <div className="flex-1 space-y-6 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Calcular Piso</h1>
          <p className="text-gray-600">Calcule a quantidade necessária de pisos, argamassa e rejunte</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
          <Card className="border-none shadow-lg h-full">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Dados do Cálculo</h3>
              <form onSubmit={handleCalcular} className="space-y-4">
                <div className="space-y-2">
                  <Label>Código do Piso</Label>
                  <Input 
                    placeholder="Ex: ASS-001"
                    value={codigoBusca}
                    onChange={(e) => setCodigoBusca(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>M² do Cliente</Label>
                  <Input 
                    type="number"
                    step="0.01"
                    placeholder="Ex: 45.5"
                    value={metragem}
                    onChange={(e) => setMetragem(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Quantidade de Caixas</Label>
                  <Input 
                    placeholder="Calculado automaticamente"
                    disabled
                    value={resultado ? resultado.quantidadeCaixas : ""}
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={calcularMutation.isPending}>
                  <Search size={18} className="mr-2" />
                  Pesquisar e Calcular
                </Button>
                <Button type="button" variant="outline" className="w-full h-11">
                  <Plus size={18} className="mr-2" />
                  Adicionar a orçamento
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg h-full">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Dados Técnicos</h3>
              <div className="bg-gray-50 p-4 rounded-lg h-[calc(100%-2rem)]">
                {piso ? (
                  <>
                    {piso.linkFoto ? (
                      <img
                        src={piso.linkFoto}
                        alt="Piso"
                        className="w-full h-48 object-cover rounded-lg mb-4 bg-white"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    ) : (
                      <div className="w-full h-48 bg-gray-200 rounded-lg mb-4 flex items-center justify-center text-gray-400">
                        <Box size={48} />
                      </div>
                    )}
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Largura:</span>
                        <span className="font-medium">{piso.largura ? `${piso.largura} cm` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Altura:</span>
                        <span className="font-medium">{piso.altura ? `${piso.altura} cm` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rejunte:</span>
                        <span className="font-medium">{piso.rejunte ? `${piso.rejunte} mm` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">PEI:</span>
                        <span className="font-medium">{piso.pei ? `PEI ${piso.pei}` : '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Tipo:</span>
                        <span className="font-medium">{piso.tipoPiso || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Local de Uso:</span>
                        <span className="font-medium">{piso.localDeUso || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">M² por caixa:</span>
                        <span className="font-medium">{piso.m2PorCaixa} m²</span>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-600">Status Estoque:</span>
                          <span className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-xs font-medium">
                            <div className="w-2 h-2 bg-black rounded-full"></div>
                            Disponível
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    Nenhum piso selecionado
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg h-full">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Enviar Orçamento</h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Telefone do Cliente</Label>
                  <Input
                    type="tel"
                    placeholder="(00) 00000-0000"
                    value={telefone}
                    onChange={(e) => setTelefone(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor por M²</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Ex: 89.90"
                    value={valorM2}
                    onChange={(e) => setValorM2(e.target.value)}
                  />
                </div>
                <Button onClick={handleWhatsApp} variant="secondary" className="w-full h-11" disabled={!resultado}>
                  <MessageCircle size={18} className="mr-2" />
                  Enviar via WhatsApp
                </Button>

                <div className="mt-6 p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-3 text-sm">Informações Adicionais</h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>• Considere {margem}% de quebra</p>
                    <p>• Verifique o nivelamento do piso</p>
                    <p>• Utilize argamassa adequada</p>
                    <p>• Respeite tempo de secagem</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {resultado && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4">
              <Card className="bg-gradient-to-br from-black to-zinc-800 text-white border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Package size={32} />
                    </div>
                  </div>
                  <p className="text-white/80 mb-2">Caixas Necessárias</p>
                  <p className="text-4xl font-bold mb-1">{resultado.quantidadeCaixas}</p>
                  <p className="text-sm text-white/70">+ {margem}% de quebra = {resultado.metragemComMargem.toFixed(2)}m²</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-zinc-800 to-zinc-700 text-white border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Layers size={32} />
                    </div>
                  </div>
                  <p className="text-white/80 mb-2">Argamassa (AC-II)</p>
                  <p className="text-4xl font-bold mb-1">{Math.ceil((parseFloat(metragem) * 4.5) / 20)}</p>
                  <p className="text-sm text-white/70">Sacos de 20kg</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-zinc-700 to-zinc-600 text-white border-none shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Box size={32} />
                    </div>
                  </div>
                  <p className="text-white/80 mb-2">Rejunte</p>
                  <p className="text-4xl font-bold mb-1">{Math.ceil((parseFloat(metragem) * 0.15) / 1)}</p>
                  <p className="text-sm text-white/70">Sacos de 1kg</p>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6 border-none shadow-lg animate-in fade-in slide-in-from-bottom-6">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">Resumo do Orçamento</h3>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Área total:</span>
                    <span className="font-medium">{metragem} m²</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Pisos ({resultado.quantidadeCaixas} caixas):</span>
                    <span className="font-medium">
                      {valorM2 ? `R$ ${(resultado.quantidadeCaixas * (piso?.m2PorCaixa || 1) * parseFloat(valorM2)).toFixed(2)}` : 'R$ 0,00'}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Argamassa ({Math.ceil((parseFloat(metragem) * 4.5) / 20)} sacos):</span>
                    <span className="font-medium text-gray-400 text-sm italic">Cálculo de valor não disponível</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Rejunte ({Math.ceil((parseFloat(metragem) * 0.15) / 1)} sacos):</span>
                    <span className="font-medium text-gray-400 text-sm italic">Cálculo de valor não disponível</span>
                  </div>
                  <div className="flex justify-between py-3 bg-zinc-100 px-4 rounded-lg mt-4">
                    <span className="font-semibold text-lg text-gray-800">Total Estimado (apenas piso):</span>
                    <span className="font-bold text-2xl text-black">
                      {valorM2 ? `R$ ${(resultado.quantidadeCaixas * (piso?.m2PorCaixa || 1) * parseFloat(valorM2)).toFixed(2)}` : 'R$ 0,00'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  )
}
