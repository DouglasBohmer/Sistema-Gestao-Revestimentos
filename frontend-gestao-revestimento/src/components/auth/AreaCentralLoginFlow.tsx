import { useState } from 'react'
import {
  cancelCurrentAreaCentralLoginAttempt,
  startAreaCentralLoginAttempt,
  type AreaCentralLoginAttempt,
} from '@workspace/api-client-react'
import { AlertCircle, CheckCircle2, ExternalLink, Monitor, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.replace(/^HTTP \d+ [^:]+:\s*/, '') : 'Não foi possível concluir a operação.'
}

export function AreaCentralLoginFlow() {
  const { completeAreaCentralLogin } = useAuth()
  const [attempt, setAttempt] = useState<AreaCentralLoginAttempt | null>(null)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function start() {
    setError('')
    setLoading(true)
    try {
      setAttempt(await startAreaCentralLoginAttempt())
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  async function complete() {
    if (!username.trim()) {
      setError('Informe o usuário usado na Área Central para identificar sua sessão.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const authenticated = await completeAreaCentralLogin(username.trim())
      if (!authenticated) {
        setError('Não foi possível confirmar a sessão da Área Central.')
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  async function cancel() {
    setLoading(true)
    try {
      await cancelCurrentAreaCentralLoginAttempt()
      setAttempt(null)
      setUsername('')
      setError('')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {!attempt ? (
        <>
          <p className="text-sm text-gray-600 leading-relaxed">
            Use a mesma conta da Área Central. O login e o CAPTCHA serão feitos em um navegador isolado no servidor; cookies e senha não ficam neste navegador.
          </p>
          <button
            type="button"
            onClick={() => void start()}
            disabled={loading}
            className="w-full py-2.5 bg-black hover:bg-zinc-800 disabled:opacity-60 text-white font-semibold rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Monitor className="h-4 w-4" />
            {loading ? 'Preparando navegador...' : 'Entrar com Área Central'}
          </button>
        </>
      ) : (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <div className="flex gap-3">
            <Monitor className="mt-0.5 h-5 w-5 shrink-0 text-zinc-700" />
            <div className="text-sm text-zinc-700">
              <p className="font-semibold text-zinc-900">Conclua a verificação na Área Central</p>
              <ol className="mt-1 list-decimal space-y-1 pl-4">
                <li>Abra a janela segura do navegador.</li>
                <li>Digite sua conta e resolva o CAPTCHA manualmente.</li>
                <li>Volte aqui e confirme o login.</li>
              </ol>
            </div>
          </div>

          <a
            href={attempt.interactiveUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            <ExternalLink className="h-4 w-4" />
            Abrir janela da Área Central
          </a>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Usuário da Área Central</label>
            <input
              type="text"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="O mesmo usuário informado na janela"
              autoComplete="username"
              disabled={loading}
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/30"
            />
          </div>

          <button
            type="button"
            onClick={() => void complete()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:opacity-60"
          >
            <CheckCircle2 className="h-4 w-4" />
            {loading ? 'Confirmando...' : 'Concluí o login'}
          </button>

          <button
            type="button"
            onClick={() => void cancel()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-200 disabled:opacity-60"
          >
            <X className="h-4 w-4" />
            Cancelar
          </button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
    </div>
  )
}
