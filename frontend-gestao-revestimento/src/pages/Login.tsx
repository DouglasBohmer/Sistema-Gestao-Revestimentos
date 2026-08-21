import { useState, FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Lock, User, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { AreaCentralLoginFlow } from '@/components/auth/AreaCentralLoginFlow'

export default function Login() {
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(username.trim(), password)
    if (!result.authenticated) setError(result.errorMessage ?? 'Não foi possível iniciar a sessão.')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-black mb-4">
            <Lock className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">RedeASSO</h1>
          <p className="text-gray-500 mt-1 text-sm">Sistema de Gestão de Revestimentos</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Entrar no sistema</h2>
          <p className="text-sm text-gray-500 mb-6">Área Central</p>

          <AreaCentralLoginFlow />

          <details className="group mt-6 border-t border-zinc-200 pt-4">
            <summary className="cursor-pointer text-sm font-medium text-zinc-600 hover:text-black">
              Acesso administrativo temporário
            </summary>

          <form onSubmit={handleSubmit} className="mt-4 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Usuário</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Digite seu usuário"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-black/30 focus:border-black transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  className="w-full pl-10 pr-11 py-2.5 border border-gray-200 rounded-lg bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-black/30 focus:border-black transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(visible => !visible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-500 hover:text-black focus:outline-none focus:ring-2 focus:ring-black/30"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-zinc-800 bg-zinc-100 border border-zinc-300 rounded-lg px-3 py-2.5 text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-black hover:bg-zinc-800 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors text-sm"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
          </details>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Casa dos Tubos © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
