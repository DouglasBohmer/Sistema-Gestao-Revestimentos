import { FormEvent, useEffect, useState } from 'react'
import {
  cancelCurrentAreaCentralLoginAttempt,
  getCurrentAreaCentralLoginAttempt,
  startAreaCentralLoginAttempt,
  type AreaCentralLoginAttempt,
} from '@workspace/api-client-react'
import { AlertCircle, LoaderCircle, ShieldCheck, User, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^HTTP \d+ [^:]+:\s*/, '')
    : 'Não foi possível concluir a operação.'
}

export function AreaCentralLoginFlow() {
  const { completeAreaCentralLogin } = useAuth()
  const [attempt, setAttempt] = useState<AreaCentralLoginAttempt | null>(null)
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    if (!attempt) return

    let active = true
    let completing = false

    async function checkLoginState() {
      if (completing) return

      try {
        const current = await getCurrentAreaCentralLoginAttempt()
        if (!active) return
        setAttempt(current)

        if (current.status !== 'READY_TO_COMPLETE') return

        completing = true
        const authenticated = await completeAreaCentralLogin()
        if (!active) return

        if (authenticated) {
          setAttempt(null)
          setModalOpen(false)
          return
        }
        setError('A Área Central não confirmou a sessão.')
        completing = false
      } catch (cause) {
        if (!active) return
        const message = errorMessage(cause)
        if (message.includes('Não há uma verificação')) {
          setAttempt(null)
          setModalOpen(false)
          return
        }
        setError(message)
        completing = false
      }
    }

    const timeout = window.setTimeout(() => void checkLoginState(), 1_000)
    const interval = window.setInterval(() => void checkLoginState(), 2_000)
    return () => {
      active = false
      window.clearTimeout(timeout)
      window.clearInterval(interval)
    }
  }, [attempt?.expiresAt, attempt?.interactiveUrl, attempt?.status, completeAreaCentralLogin])

  async function start(event: FormEvent) {
    event.preventDefault()
    if (!username.trim()) return

    setError('')
    setLoading(true)
    try {
      const nextAttempt = await startAreaCentralLoginAttempt({
        username: username.trim(),
      })
      setAttempt(nextAttempt)
      setModalOpen(true)
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
      setModalOpen(false)
      setError('')
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <form onSubmit={event => void start(event)} className="space-y-5">
        <p className="text-sm leading-relaxed text-gray-600">
          Informe seu usuário para identificar a sessão. A senha será digitada somente no navegador isolado da Área Central e não passa pelo RedeASSO.
        </p>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Usuário da Área Central</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="Seu usuário"
              autoComplete="username"
              required
              disabled={loading || Boolean(attempt)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || Boolean(attempt)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {loading ? 'Abrindo a Área Central...' : 'Abrir login da Área Central'}
        </button>
      </form>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {attempt && modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="area-central-modal-title">
          <section className="flex h-[min(760px,calc(100vh-1.5rem))] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <h3 id="area-central-modal-title" className="font-semibold text-zinc-900">
                  {attempt.status === 'READY_TO_COMPLETE' ? 'Concluindo acesso...' : 'Entre na Área Central'}
                </h3>
                <p className="mt-1 text-sm text-zinc-600">
                  Digite seu usuário e senha na página real e confirme “Sou humano”. O RedeASSO não preenche nem recebe sua senha.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={loading}
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-black disabled:opacity-60"
                aria-label="Cancelar login da Área Central"
                title="Cancelar"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="relative min-h-0 flex-1 bg-zinc-100">
              <iframe
                src={attempt.interactiveUrl}
                title="Navegador isolado da Área Central"
                referrerPolicy="no-referrer"
                className="h-full w-full border-0 bg-white"
              />
              {attempt.status === 'READY_TO_COMPLETE' && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/85 backdrop-blur-sm">
                  <div className="flex items-center gap-3 rounded-xl bg-white px-5 py-4 text-sm font-medium text-zinc-800 shadow-lg">
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Salvando a sessão segura...
                  </div>
                </div>
              )}
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500">
              <span>O CAPTCHA não é automatizado e a senha não é armazenada.</span>
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={loading}
                className="font-medium text-zinc-700 hover:text-black disabled:opacity-60"
              >
                Cancelar
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  )
}
