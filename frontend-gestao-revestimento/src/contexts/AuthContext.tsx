import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import {
  clearCsrfToken,
  completeAreaCentralLoginAttempt,
  getAuthSession,
  localLogin,
  logout as apiLogout,
  type SessionResponse,
} from '@workspace/api-client-react'

interface AuthContextType {
  isAuthenticated: boolean
  isLoading: boolean
  session: SessionResponse | null
  login: (username: string, password: string) => Promise<boolean>
  completeAreaCentralLogin: (username: string) => Promise<boolean>
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

  async function login(username: string, password: string) {
    try {
      const authenticatedSession = await localLogin({ username, password })
      setSession(authenticatedSession)
      return authenticatedSession.authenticated
    } catch {
      setSession(null)
      return false
    }
  }

  async function completeAreaCentralLogin(username: string) {
    const authenticatedSession = await completeAreaCentralLoginAttempt({ username })
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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
