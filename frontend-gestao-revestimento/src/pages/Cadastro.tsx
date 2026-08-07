import { useState, useRef, useEffect } from "react"
import { Layout } from "@/components/layout/Layout"
import { useListPisos, useCreatePiso, useUpdatePiso, useDeletePiso, getListPisosQueryKey, type Piso } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Card, CardContent } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Save, Edit, Trash2, Search, Printer, X, Image as ImageIcon, Plus } from "lucide-react"

const pisoSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  codigoRede: z.string().optional(),
  codigoLoja: z.string().min(1, "Código da loja é obrigatório"),
  largura: z.coerce.number().optional(),
  altura: z.coerce.number().optional(),
  rejunte: z.coerce.number().optional(),
  pecasPorCaixa: z.coerce.number().optional(),
  m2PorCaixa: z.coerce.number().min(0.01, "M²/Caixa é obrigatório"),
  localDeUso: z.string().optional(),
  tipoPiso: z.string().optional(),
  pei: z.coerce.number().optional(),
  retificado: z.string().default("nao"),
  linkSite: z.string().optional(),
  linkFoto: z.string().optional(),
  valor: z.coerce.number().optional()
})

type PisoFormValues = z.infer<typeof pisoSchema>

export default function Cadastro() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  const [search, setSearch] = useState("")
  
  const [editingId, setEditingId] = useState<number | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [selectedPiso, setSelectedPiso] = useState<Piso | null>(null)

  const { data: pisos, isLoading } = useListPisos({
    search: search || undefined,
  })

  const createPiso = useCreatePiso()
  const updatePiso = useUpdatePiso()
  const deletePiso = useDeletePiso()

  const form = useForm<PisoFormValues>({
    resolver: zodResolver(pisoSchema),
    defaultValues: {
      nome: "",
      codigoRede: "",
      codigoLoja: "",
      largura: undefined,
      altura: undefined,
      rejunte: undefined,
      pecasPorCaixa: undefined,
      m2PorCaixa: 0,
      localDeUso: "",
      tipoPiso: "",
      pei: undefined,
      retificado: "nao",
      linkSite: "",
      linkFoto: "",
      valor: undefined
    }
  })

  const linkFotoValue = form.watch("linkFoto")

  const handleSelectPiso = (piso: Piso) => {
    setSelectedPiso(piso)
    setEditingId(piso.id)
    setIsEditing(false) // Selected for viewing, not editing yet
    form.reset({
      nome: piso.nome,
      codigoRede: piso.codigoRede || "",
      codigoLoja: piso.codigoLoja,
      largura: piso.largura || undefined,
      altura: piso.altura || undefined,
      rejunte: piso.rejunte || undefined,
      pecasPorCaixa: piso.pecasPorCaixa || undefined,
      m2PorCaixa: piso.m2PorCaixa,
      localDeUso: piso.localDeUso || "",
      tipoPiso: piso.tipoPiso || "",
      pei: piso.pei || undefined,
      retificado: piso.retificado ? "sim" : "nao",
      linkSite: piso.linkSite || "",
      linkFoto: piso.linkFoto || "",
      valor: piso.valor || undefined
    })
  }

  const handleNew = () => {
    setEditingId(null)
    setSelectedPiso(null)
    setIsEditing(true)
    form.reset({
      nome: "", codigoRede: "", codigoLoja: "", largura: undefined, altura: undefined,
      rejunte: undefined, pecasPorCaixa: undefined, m2PorCaixa: 0, localDeUso: "",
      tipoPiso: "", pei: undefined, retificado: "nao", linkSite: "", linkFoto: "", valor: undefined
    })
  }

  const handleEdit = () => {
    if (editingId) {
      setIsEditing(true)
    } else {
      toast({ title: "Aviso", description: "Selecione um piso na tabela para alterar." })
    }
  }

  const handleDelete = () => {
    if (!editingId) {
      toast({ title: "Aviso", description: "Selecione um piso para excluir." })
      return
    }
    if (window.confirm("Tem certeza que deseja excluir este piso?")) {
      deletePiso.mutate({ id: editingId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPisosQueryKey() })
          toast({ title: "Piso excluído", description: "O registro foi removido com sucesso." })
          handleNew()
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível excluir o piso.", variant: "destructive" })
        }
      })
    }
  }

  const handleLimpar = () => {
    handleNew()
  }

  const onSubmit = (data: PisoFormValues) => {
    const payload = {
      ...data,
      codigoRede: data.codigoRede || undefined,
      localDeUso: data.localDeUso || undefined,
      tipoPiso: data.tipoPiso || undefined,
      linkSite: data.linkSite || undefined,
      linkFoto: data.linkFoto || undefined,
      retificado: data.retificado === "sim"
    }

    if (editingId) {
      updatePiso.mutate({ id: editingId, data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPisosQueryKey() })
          setIsEditing(false)
          toast({ title: "Sucesso", description: "Piso atualizado com sucesso." })
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" })
        }
      })
    } else {
      createPiso.mutate({ data: payload }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListPisosQueryKey() })
          handleNew()
          toast({ title: "Sucesso", description: "Novo piso cadastrado." })
        },
        onError: () => {
          toast({ title: "Erro", description: "Não foi possível cadastrar.", variant: "destructive" })
        }
      })
    }
  }

  return (
    <Layout>
      <div className="flex-1 space-y-6 p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Cadastro de Piso</h1>
          <p className="text-gray-600">Adicione ou edite informações de pisos cerâmicos e porcelanatos</p>
        </div>

        <Card className="border-none shadow-lg">
          <CardContent className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="nome" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome do Piso *</FormLabel>
                          <FormControl><Input placeholder="Ex: Porcelanato Marmorizado" disabled={!isEditing} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="codigoRede" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código Asso</FormLabel>
                          <FormControl><Input placeholder="Ex: ASS-001" disabled={!isEditing} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="codigoLoja" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código Loja *</FormLabel>
                          <FormControl><Input placeholder="Ex: LJ-001" disabled={!isEditing} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="largura" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Largura (cm)</FormLabel>
                          <FormControl><Input type="number" step="0.01" placeholder="Ex: 60" disabled={!isEditing} {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="altura" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Altura (cm)</FormLabel>
                          <FormControl><Input type="number" step="0.01" placeholder="Ex: 60" disabled={!isEditing} {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="rejunte" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rejunte (mm)</FormLabel>
                          <FormControl><Input type="number" step="0.5" placeholder="Ex: 3" disabled={!isEditing} {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="pecasPorCaixa" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peças por Caixa</FormLabel>
                          <FormControl><Input type="number" placeholder="Ex: 4" disabled={!isEditing} {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="m2PorCaixa" render={({ field }) => (
                        <FormItem>
                          <FormLabel>M² por Caixa *</FormLabel>
                          <FormControl><Input type="number" step="0.01" placeholder="Ex: 1.44" disabled={!isEditing} {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="localDeUso" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Local de Uso</FormLabel>
                          <Select disabled={!isEditing} onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Interno">Interno</SelectItem>
                              <SelectItem value="Externo">Externo</SelectItem>
                              <SelectItem value="Ambos">Ambos</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="tipoPiso" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tipo de Piso</FormLabel>
                          <Select disabled={!isEditing} onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="Cerâmico">Cerâmico</SelectItem>
                              <SelectItem value="Porcelanato">Porcelanato</SelectItem>
                              <SelectItem value="Pedra Natural">Pedra Natural</SelectItem>
                              <SelectItem value="Pastilha">Pastilha</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="pei" render={({ field }) => (
                        <FormItem>
                          <FormLabel>PEI</FormLabel>
                          <Select disabled={!isEditing} onValueChange={(val) => field.onChange(parseInt(val))} value={field.value ? String(field.value) : undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="1">PEI 1</SelectItem>
                              <SelectItem value="2">PEI 2</SelectItem>
                              <SelectItem value="3">PEI 3</SelectItem>
                              <SelectItem value="4">PEI 4</SelectItem>
                              <SelectItem value="5">PEI 5</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="retificado" render={({ field }) => (
                        <FormItem>
                          <FormLabel>É Retificado?</FormLabel>
                          <div className="flex gap-4 items-center h-[40px]">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="retificado" value="sim" disabled={!isEditing} checked={field.value === "sim"} onChange={() => field.onChange("sim")} className="w-4 h-4 text-primary accent-primary" />
                              <span className="text-sm font-medium">Sim</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="retificado" value="nao" disabled={!isEditing} checked={field.value === "nao"} onChange={() => field.onChange("nao")} className="w-4 h-4 text-primary accent-primary" />
                              <span className="text-sm font-medium">Não</span>
                            </label>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={form.control} name="linkSite" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Site Piso</FormLabel>
                          <FormControl><Input type="url" placeholder="https://exemplo.com" disabled={!isEditing} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="linkFoto" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Link da Foto</FormLabel>
                          <FormControl><Input type="url" placeholder="https://exemplo.com/foto.jpg" disabled={!isEditing} {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={form.control} name="valor" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Valor R$</FormLabel>
                          <FormControl><Input type="number" step="0.01" placeholder="Ex: 89.90" disabled={!isEditing} {...field} value={field.value ?? ""} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-2 h-full">
                      <label className="text-sm font-medium">Imagem do Piso</label>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center flex-1 min-h-[300px] bg-gray-50 overflow-hidden relative">
                        {linkFotoValue ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            <img src={linkFotoValue} alt="Preview" className="max-w-full max-h-[300px] object-contain rounded-lg" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                            {isEditing && (
                              <button
                                type="button"
                                onClick={() => form.setValue("linkFoto", "", { shouldDirty: true })}
                                className="absolute top-2 right-2 bg-destructive text-destructive-foreground p-2 rounded-full hover:bg-destructive/90 transition-colors shadow-sm"
                              >
                                <X size={16} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="text-center text-muted-foreground">
                            <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                            <p className="mb-4 text-sm">Nenhuma imagem selecionada</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <div className="flex flex-wrap gap-3">
                    <Button type="submit" disabled={!isEditing || createPiso.isPending || updatePiso.isPending} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                      <Save size={18} className="mr-2" />
                      Salvar
                    </Button>
                    <Button type="button" variant="outline" onClick={handleEdit} disabled={isEditing && !editingId}>
                      <Edit size={18} className="mr-2" />
                      Alterar
                    </Button>
                    <Button type="button" variant="destructive" onClick={handleDelete}>
                      <Trash2 size={18} className="mr-2" />
                      Excluir
                    </Button>
                    <div className="flex-1"></div>
                    <Button type="button" variant="secondary" onClick={() => document.getElementById('search-input')?.focus()}>
                      <Search size={18} className="mr-2" />
                      Pesquisar
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => toast({ title: "Info", description: "Funcionalidade de impressão em breve." })}>
                      <Printer size={18} className="mr-2" />
                      Imprimir Etiqueta
                    </Button>
                    <Button type="button" variant="outline" onClick={handleLimpar}>
                      <Plus size={18} className="mr-2" />
                      Novo
                    </Button>
                  </div>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="mt-8">
          <div className="relative mb-6 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              id="search-input"
              placeholder="Buscar por nome ou código..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead>Identificação</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Tipo / Local</TableHead>
                  <TableHead>M²/Cx</TableHead>
                  <TableHead>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        <span className="mt-2 text-sm text-muted-foreground">Carregando catálogo...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : pisos && pisos.length > 0 ? (
                  pisos.map((piso) => (
                    <TableRow 
                      key={piso.id} 
                      onClick={() => handleSelectPiso(piso)}
                      className={`cursor-pointer transition-colors ${editingId === piso.id ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
                    >
                      <TableCell>
                        <div className="font-medium text-foreground">{piso.nome}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-1 flex gap-2">
                          <span>L: {piso.codigoLoja}</span>
                          {piso.codigoRede && <span>R: {piso.codigoRede}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {piso.largura && piso.altura ? `${piso.largura}x${piso.altura}cm` : '-'}
                        </div>
                        {piso.retificado && <span className="text-[10px] text-muted-foreground inline-block mt-1">Retificado</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          {piso.tipoPiso && <span className="text-sm font-medium">{piso.tipoPiso}</span>}
                          {piso.localDeUso && <span className="text-xs text-muted-foreground">{piso.localDeUso}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {piso.m2PorCaixa} m²
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium">
                          {piso.valor ? `R$ ${piso.valor.toFixed(2)}` : '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <div className="flex flex-col items-center justify-center text-muted-foreground">
                        <p>Nenhum piso encontrado.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </Layout>
  )
}
