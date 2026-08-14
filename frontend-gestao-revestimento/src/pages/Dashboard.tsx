import { 
  useGetDashboardStats, 
  useGetAtividadeRecente, 
} from "@workspace/api-client-react"
import { Link } from "wouter"
import { Layout } from "@/components/layout/Layout"
import { Card, CardContent } from "@/components/ui/card"
import { FileText, Calculator, Package, Box, TrendingUp } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"

export default function Dashboard() {
  const { data: stats, isLoading: loadingStats } = useGetDashboardStats()
  const { data: atividades, isLoading: loadingAtividades } = useGetAtividadeRecente()

  return (
    <Layout>
      <div className="flex-1 space-y-6 p-8">
        <div className="text-center mb-12 mt-6">
          <h1 className="text-4xl font-bold text-gray-800 mb-3 tracking-tight">
            Bem-vindo ao RedeASSO
          </h1>
          <p className="text-xl text-gray-600">
            Sistema Completo de Gestão de Pisos Cerâmicos e Porcelanatos
          </p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
          <Card className="hover:shadow-xl transition-shadow border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-black p-3 rounded-lg text-white">
                  <Package className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm mb-1">Pisos Cadastrados</h3>
              {loadingStats ? (
                <div className="h-9 w-16 animate-pulse bg-muted rounded mb-2"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-800 mb-2">{stats?.totalPisos || 0}</p>
              )}
              <p className="text-sm text-gray-500">No sistema</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-shadow border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-zinc-800 p-3 rounded-lg text-white">
                  <FileText className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm mb-1">Impressões Realizadas</h3>
              {loadingStats ? (
                <div className="h-9 w-16 animate-pulse bg-muted rounded mb-2"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-800 mb-2">{stats?.totalImpressoes || 0}</p>
              )}
              <p className="text-sm text-gray-500">Esta semana</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-shadow border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-zinc-700 p-3 rounded-lg text-white">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm mb-1">Cálculos Feitos</h3>
              {loadingStats ? (
                <div className="h-9 w-16 animate-pulse bg-muted rounded mb-2"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-800 mb-2">{stats?.calculosRealizados || 0}</p>
              )}
              <p className="text-sm text-gray-500">Este mês</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-xl transition-shadow border-none shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="bg-zinc-600 p-3 rounded-lg text-white">
                  <Box className="h-6 w-6" />
                </div>
              </div>
              <h3 className="text-gray-600 text-sm mb-1">Tipos no Catálogo</h3>
              {loadingStats ? (
                <div className="h-9 w-16 animate-pulse bg-muted rounded mb-2"></div>
              ) : (
                <p className="text-3xl font-bold text-gray-800 mb-2">{stats?.estoqueDisponivel || 0}</p>
              )}
              <p className="text-sm text-gray-500">Categorias ativas</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Atalhos Rápidos</h3>
              <div className="space-y-3">
                <Link href="/cadastro" className="w-full p-4 bg-[#D9D9D9] hover:bg-gray-300 rounded-lg text-left transition-all flex items-center gap-3">
                  <Package size={20} className="text-black" />
                  <div>
                    <p className="font-medium text-gray-800">Novo Cadastro</p>
                    <p className="text-sm text-gray-600">Adicionar novo piso ao sistema</p>
                  </div>
                </Link>
                <Link href="/calcular" className="w-full p-4 bg-[#D9D9D9] hover:bg-gray-300 rounded-lg text-left transition-all flex items-center gap-3">
                  <TrendingUp size={20} className="text-black" />
                  <div>
                    <p className="font-medium text-gray-800">Calcular Piso</p>
                    <p className="text-sm text-gray-600">Calcular quantidade necessária</p>
                  </div>
                </Link>
                <Link href="/calcular" className="w-full p-4 bg-[#D9D9D9] hover:bg-gray-300 rounded-lg text-left transition-all flex items-center gap-3">
                  <FileText size={20} className="text-black" />
                  <div>
                    <p className="font-medium text-gray-800">Imprimir Etiqueta</p>
                    <p className="text-sm text-gray-600">Gerar etiqueta de produto</p>
                  </div>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Atividades Recentes</h3>
              <div className="space-y-4">
                {loadingAtividades ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg animate-pulse">
                        <div className="w-2 h-2 bg-gray-300 rounded-full mt-2"></div>
                        <div className="space-y-2 flex-1">
                          <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
                          <div className="h-3 w-1/4 bg-gray-200 rounded"></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : atividades && atividades.length > 0 ? (
                  atividades.slice(0, 5).map((atividade) => {
                    const colorClass = 
                      atividade.tipo === 'calculo' ? 'bg-black' :
                      atividade.tipo === 'cadastro' ? 'bg-zinc-700' : 'bg-zinc-500';
                    
                    return (
                      <div key={atividade.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${colorClass}`}></div>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{atividade.descricao}</p>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {formatDistanceToNow(new Date(atividade.createdAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <p className="text-gray-500 text-sm py-4">Nenhuma atividade recente encontrada.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  )
}
