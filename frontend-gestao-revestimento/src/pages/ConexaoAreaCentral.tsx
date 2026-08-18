import { CheckCircle2 } from 'lucide-react'
import { Layout } from '@/components/layout/Layout'
import { AreaCentralLoginFlow } from '@/components/auth/AreaCentralLoginFlow'
import { useAuth } from '@/contexts/AuthContext'

export default function ConexaoAreaCentral() {
  const { session } = useAuth()

  return (
    <Layout>
      <div className="mx-auto w-full max-w-xl p-8">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Área Central</h1>
        <p className="mt-2 text-zinc-600">Conecte uma sessão externa para consultar preços e estoque em tempo real.</p>

        <div className="mt-8 rounded-2xl bg-white p-6 shadow-lg">
          {session?.areaCentralConnected ? (
            <div className="flex gap-3 text-zinc-800">
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-zinc-900" />
              <div>
                <h2 className="font-semibold">Área Central conectada</h2>
                <p className="mt-1 text-sm text-zinc-600">A sessão externa está disponível somente enquanto este servidor permanecer em execução.</p>
              </div>
            </div>
          ) : (
            <AreaCentralLoginFlow />
          )}
        </div>
      </div>
    </Layout>
  )
}
