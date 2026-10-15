import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  cancelCurrentAreaCentralLoginAttempt,
  getCurrentAreaCentralLoginAttempt,
  startAreaCentralLoginAttempt,
  ApiError,
  type AreaCentralLoginAttempt,
} from '@workspace/api-client-react'
import { AlertCircle, Eye, EyeOff, LoaderCircle, Lock, ShieldCheck, User, X } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { areaCentralLoginError } from './area-central-login-error'

function errorMessage(error: unknown) {
  if (error instanceof ApiError) return areaCentralLoginError(error.status, error.data)
  return 'Não foi possível comunicar com o serviço de login. Verifique o serviço no Render e tente novamente.'
}

export function AreaCentralLoginFlow() {
  const { completeAreaCentralLogin } = useAuth()
  const [attempt, setAttempt] = useState<AreaCentralLoginAttempt | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [verificationVersion, setVerificationVersion] = useState(0)
  const cancelled = useRef(false)
  const completing = useRef(false)

  useEffect(() => {
    if (!attempt) return

    let active = true
    let timeout: number | undefined
    const controller = new AbortController()

    async function checkLoginState() {
      try {
        const current = await getCurrentAreaCentralLoginAttempt({ signal: controller.signal })
        if (!active || cancelled.current) return
        setAttempt(current)

        if (current.status !== 'READY_TO_COMPLETE') {
          timeout = window.setTimeout(() => void checkLoginState(), 2_000)
        }
        // Modo de observação: não fecha o navegador nem conclui o acesso sozinho.
      } catch (cause) {
        if (!active || cancelled.current) return
        setError(errorMessage(cause))
        // Preserva a janela e a concessão existente para inspeção. O limite de
        // dez minutos e o cancelamento explícito continuam sendo respeitados.
      }
    }

    timeout = window.setTimeout(() => void checkLoginState(), 1_000)
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [attempt?.expiresAt, attempt?.interactiveUrl, verificationVersion])

  async function start(event: FormEvent) {
    event.preventDefault()
    if (!username.trim() || !password) return

    setError('')
    setLoading(true)
    setModalOpen(true)
    cancelled.current = false
    try {
      const pending = startAreaCentralLoginAttempt({
        username: username.trim(),
        password,
      })
      setPassword('')
      setShowPassword(false)
      const nextAttempt = await pending
      setAttempt(nextAttempt)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
      setPassword('')
      setShowPassword(false)
    }
  }

  async function finish() {
    if (!attempt || attempt.status !== 'READY_TO_COMPLETE' || completing.current) return
    completing.current = true
    setLoading(true)
    setError('')
    try {
      if (await completeAreaCentralLogin()) {
        setAttempt(null)
        setModalOpen(false)
      } else {
        setError('A Área Central não confirmou a sessão. A janela foi mantida para análise.')
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      completing.current = false
      setLoading(false)
    }
  }

  async function cancel() {
    if (completing.current) return
    cancelled.current = true
    setLoading(true)
    setAttempt(null)
    setModalOpen(false)
    try {
      await cancelCurrentAreaCentralLoginAttempt()
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
          Use sua conta da Área Central e acompanhe o login nesta tela. Seu acesso permanece conectado por até 12 horas, enquanto a sessão estiver válida.
        </p>

        <div>
          <label htmlFor="area-central-username" className="mb-1.5 block text-sm font-medium text-gray-700">Usuário da Área Central</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="area-central-username"
              type="text"
              value={username}
              onChange={event => setUsername(event.target.value)}
              placeholder="Seu usuário"
              autoComplete="username"
              maxLength={160}
              required
              disabled={loading || Boolean(attempt)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm transition focus:border-black focus:outline-none focus:ring-2 focus:ring-black/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        <div>
          <label htmlFor="area-central-password" className="mb-1.5 block text-sm font-medium text-gray-700">Senha</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="area-central-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete="current-password"
              maxLength={1024}
              placeholder="Sua senha"
              required
              disabled={loading || Boolean(attempt)}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-12 text-sm focus:border-black focus:outline-none focus:ring-2 focus:ring-black/30 disabled:opacity-60"
            />
            <button type="button" onClick={() => setShowPassword(value => !value)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-gray-500 hover:text-black">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || Boolean(attempt)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-black py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading || attempt ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {loading || attempt ? 'Entrando...' : 'Entrar'}
        </button>
        {attempt && !modalOpen && (
          <div className="flex items-center justify-between gap-3 text-sm text-gray-600" role="status">
            <span>Aguardando a confirmação da Área Central...</span>
            <button type="button" onClick={() => setModalOpen(true)} className="underline">Verificação</button>
            <button type="button" disabled={loading} onClick={() => void cancel()} className="underline">Cancelar</button>
          </div>
        )}
      </form>

      {error && !modalOpen && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {modalOpen && (
        <Dialog open={modalOpen} onOpenChange={open => { if (!open && !loading) void cancel() }}>
          <DialogContent
            className="flex h-[min(760px,calc(100dvh-1.5rem))] w-[calc(100vw-1.5rem)] max-w-5xl flex-col gap-0 overflow-hidden rounded-2xl bg-white p-0 shadow-2xl sm:rounded-2xl [&>button]:hidden"
            onInteractOutside={event => event.preventDefault()}
            onEscapeKeyDown={event => { if (loading) event.preventDefault() }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-zinc-200 px-5 py-4">
              <div>
                <DialogTitle className="font-semibold text-zinc-900">
                  Login da Área Central — acompanhamento
                </DialogTitle>
                <DialogDescription className="mt-1 text-sm text-zinc-600">
                  A janela fica aberta para você analisar o login e a verificação. Quando o acesso for reconhecido, clique em “Concluir e entrar”.
                </DialogDescription>
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

            {error && (
              <div role="alert" className="flex shrink-0 items-start gap-2 border-b border-zinc-300 bg-zinc-100 px-5 py-3 text-sm text-zinc-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 break-words">{error}</span>
              </div>
            )}

            <div className="relative min-h-0 flex-1 bg-zinc-100">
              {attempt ? (
                <iframe
                  src={attempt.interactiveUrl}
                  title="Navegador isolado da Área Central"
                  referrerPolicy="no-referrer"
                  className="h-full w-full border-0 bg-white"
                />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <div className="max-w-md space-y-3 text-sm text-zinc-600" role="status">
                    {loading && <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-black" />}
                    <p className="font-medium text-zinc-900">{loading ? 'Abrindo o navegador da Área Central...' : 'A tela da Área Central não foi disponibilizada.'}</p>
                    <p>{loading
                      ? 'A sessão protegida está sendo iniciada no serviço. A página real aparecerá aqui assim que estiver disponível.'
                      : 'A comunicação falhou antes de recebermos a sessão do navegador. Feche esta janela e tente novamente após verificar o serviço no Render.'}</p>
                  </div>
                </div>
              )}
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 px-5 py-3 text-xs text-zinc-500">
              <div className="space-y-1" role="status">
                <p className="font-medium text-zinc-800">{attempt?.status === 'READY_TO_COMPLETE'
                  ? 'Login reconhecido. Aguardando você concluir.'
                  : error ? 'Verificação interrompida; janela mantida para análise.'
                    : attempt ? 'Acompanhando o login na página real...' : 'Aguardando a abertura da sessão...'}</p>
                <p>O CAPTCHA não é automatizado e a senha não é armazenada.</p>
              </div>
              <div className="flex items-center gap-4">
                {attempt && error && (
                  <button type="button" disabled={loading} onClick={() => {
                    setError('')
                    setVerificationVersion(value => value + 1)
                  }} className="font-medium text-zinc-700 underline disabled:opacity-60">Verificar novamente</button>
                )}
                <button
                  type="button"
                  onClick={() => void cancel()}
                  disabled={loading}
                  className="font-medium text-zinc-700 hover:text-black disabled:opacity-60"
                >
                  Fechar e cancelar
                </button>
                {attempt?.status === 'READY_TO_COMPLETE' && !error && (
                  <button type="button" onClick={() => void finish()} disabled={loading}
                    className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                    {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    {loading ? 'Salvando sessão...' : 'Concluir e entrar'}
                  </button>
                )}
              </div>
            </footer>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
