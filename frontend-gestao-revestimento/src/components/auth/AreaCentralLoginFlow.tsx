import { FormEvent, useEffect, useRef, useState } from 'react'
import {
  cancelCurrentAreaCentralLoginAttempt,
  getCurrentAreaCentralLoginAttempt,
  startAreaCentralLoginAttempt,
  ApiError,
  type AreaCentralLoginAttempt,
} from '@workspace/api-client-react'
import { AlertCircle, ExternalLink, Eye, EyeOff, LoaderCircle, Lock, ShieldCheck, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { areaCentralLoginError } from './area-central-login-error'
import { openAreaCentralLoginTab, type AreaCentralLoginTab } from './area-central-login-tab'

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
  const [tabOpened, setTabOpened] = useState(false)
  const [verificationVersion, setVerificationVersion] = useState(0)
  const cancelled = useRef(false)
  const completing = useRef(false)
  const starting = useRef(false)
  const loginTab = useRef<AreaCentralLoginTab | null>(null)
  const startController = useRef<AbortController | null>(null)

  useEffect(() => () => {
    startController.current?.abort()
    loginTab.current?.close()
  }, [])

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
        // A nova guia permanece aberta até a conclusão explícita ou cancelamento.
      } catch (cause) {
        if (!active || cancelled.current) return
        setError(errorMessage(cause))
        // Preserva a guia e a concessão existente para inspeção. O limite de
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
    if (!username.trim() || !password || starting.current || loading || attempt) return

    // Reserva a guia no gesto do usuário, antes da chamada à API. Abrir após
    // o await pode ser bloqueado como pop-up pelo navegador.
    const tab = openAreaCentralLoginTab()
    if (!tab) {
      setError('O navegador bloqueou a nova guia. Permita pop-ups para este site e clique em Entrar novamente.')
      return
    }
    loginTab.current?.close()
    loginTab.current = tab
    setTabOpened(true)
    starting.current = true

    setError('')
    setLoading(true)
    cancelled.current = false
    const controller = new AbortController()
    startController.current = controller
    const timeout = window.setTimeout(() => controller.abort(), 100_000)
    try {
      const pending = startAreaCentralLoginAttempt({
        username: username.trim(),
        password,
      }, { signal: controller.signal })
      setPassword('')
      setShowPassword(false)
      const nextAttempt = await pending
      setAttempt(nextAttempt)
      if (!tab.navigate(nextAttempt.interactiveUrl)) {
        setError('A sessão foi preparada, mas a guia foi fechada ou não pôde ser atualizada. Clique em “Abrir guia do login”.')
      }
    } catch (cause) {
      const message = controller.signal.aborted
        ? 'O serviço demorou demais para preparar o navegador da Área Central. Tente novamente após verificar o Render.'
        : errorMessage(cause)
      setError(message)
      tab.showError(message)
    } finally {
      window.clearTimeout(timeout)
      startController.current = null
      starting.current = false
      setLoading(false)
      setPassword('')
      setShowPassword(false)
    }
  }

  function showLoginTab() {
    if (!attempt) return
    if (loginTab.current?.isOpen()) {
      loginTab.current.focus()
      return
    }
    const tab = openAreaCentralLoginTab()
    if (!tab) {
      setError('O navegador bloqueou a nova guia. Permita pop-ups para este site e tente novamente.')
      return
    }
    loginTab.current = tab
    if (!tab.navigate(attempt.interactiveUrl)) {
      const message = 'Não foi possível abrir a guia protegida do login. Cancele e inicie uma nova tentativa.'
      setError(message)
      tab.showError(message)
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
        loginTab.current?.close()
        loginTab.current = null
        setTabOpened(false)
      } else {
        setError('A Área Central não confirmou a sessão. A guia foi mantida para análise.')
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
    loginTab.current?.close()
    loginTab.current = null
    setTabOpened(false)
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
          Use sua conta da Área Central. O login abrirá em uma nova guia; depois da verificação, volte aqui para concluir. Seu acesso permanece conectado por até 12 horas, enquanto a sessão estiver válida.
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
          {loading ? 'Preparando acesso...' : attempt ? 'Login em andamento na outra guia' : 'Entrar'}
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-4 flex items-start gap-2 rounded-lg border border-zinc-300 bg-zinc-100 px-3 py-2.5 text-sm text-zinc-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 break-words">{error}</span>
        </div>
      )}

      {tabOpened && (
        <section className="mt-4 space-y-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
          <p role="status" className="font-medium text-zinc-900">
            {error ? 'O login precisa de atenção.'
              : attempt?.status === 'READY_TO_COMPLETE' ? 'Login reconhecido. Você já pode concluir o acesso.'
                : attempt ? 'Conclua a verificação na outra guia e volte aqui.'
                  : 'Preparando a sessão na nova guia...'}
          </p>
          <p>A guia mostra o navegador protegido do serviço, sem quadro interno. O CAPTCHA continua manual.</p>
          <div className="flex flex-wrap items-center gap-3">
            {attempt && (
              <button type="button" onClick={showLoginTab} disabled={loading}
                className="inline-flex items-center gap-2 font-medium underline disabled:opacity-60">
                <ExternalLink className="h-4 w-4" /> Abrir guia do login
              </button>
            )}
            {attempt && error && (
              <button type="button" disabled={loading} onClick={() => {
                setError('')
                setVerificationVersion(value => value + 1)
              }} className="font-medium underline disabled:opacity-60">Verificar novamente</button>
            )}
            <button type="button" onClick={() => void cancel()} disabled={loading}
              className="font-medium underline disabled:opacity-60">Fechar e cancelar</button>
          </div>
          {attempt?.status === 'READY_TO_COMPLETE' && !error && (
            <button type="button" onClick={() => void finish()} disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
              {loading ? 'Salvando sessão...' : 'Concluir e entrar'}
            </button>
          )}
        </section>
      )}
    </>
  )
}
