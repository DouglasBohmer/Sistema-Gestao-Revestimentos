import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  ApiError,
  clearCsrfToken,
  completeAreaCentralLoginAttempt,
  getAuthSession,
  localLogin,
  logout as apiLogout,
  type SessionResponse,
} from '@workspace/api-client-react'

export interface LocalLoginResult {
  authenticated: boolean
  errorMessage?: string
}

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  session: SessionResponse | null
  login: (username: string, password: string) => Promise<LocalLoginResult>
  completeAreaCentralLogin: () => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    getAuthSession()
      .then((currentSession) => {
        if (mounted) setSession(currentSession)
      })
      .catch(() => {
        if (mounted) setSession(null)
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  async function login(username: string, password: string): Promise<LocalLoginResult> {
    try {
      const authenticatedSession = await localLogin({ username, password })
      setSession(authenticatedSession)
      return authenticatedSession.authenticated
        ? { authenticated: true }
        : { authenticated: false, errorMessage: 'Não foi possível iniciar a sessão.' }
    } catch (error) {
      setSession(null)
      return { authenticated: false, errorMessage: localLoginErrorMessage(error) }
    }
  }

  async function completeAreaCentralLogin() {
    const authenticatedSession = await completeAreaCentralLoginAttempt()
    setSession(authenticatedSession)
    return authenticatedSession.authenticated
  }

  async function logout() {
    try {
      await apiLogout()
    } finally {
      clearCsrfToken()
      setSession(null)
    }
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated: session?.authenticated === true,
      isLoading,
      session,
      login,
      completeAreaCentralLogin,
      logout,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

function localLoginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Usuário ou senha incorretos.'
    if (error.status === 403) return 'A sessão de segurança expirou. Atualize a página e tente novamente.'
    if ([502, 503, 504].includes(error.status)) {
      const errorCode = getErrorCode(error.data)
      if (errorCode === 'API_ORIGIN_MISSING') {
        return 'A conexão entre Cloudflare e Render ainda não foi publicada. Salve e publique a variável API_ORIGIN no Worker.'
      }
      if (errorCode === 'API_UPSTREAM_UNREACHABLE') {
        return 'O Render não respondeu à chamada do Cloudflare. Verifique o endpoint de saúde do Render.'
      }
      return 'A API do sistema está indisponível no momento. Aguarde um instante e tente novamente.'
    }
  }

  return 'Não foi possível comunicar com a API do sistema. Tente novamente em instantes.'
}

function getErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const code = (data as Record<string, unknown>).code
  return typeof code === 'string' ? code : undefined
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
