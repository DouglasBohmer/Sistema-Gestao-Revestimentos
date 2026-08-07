import { createContext, useContext, useState, ReactNode } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  login: (username: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => sessionStorage.getItem('redeasso_auth') === 'true'
  )

  function login(username: string, password: string) {
    if (username === 'admin' && password === 'admin') {
      setIsAuthenticated(true)
      sessionStorage.setItem('redeasso_auth', 'true')
      return true
    }
    return false
  }

  function logout() {
    setIsAuthenticated(false)
    sessionStorage.removeItem('redeasso_auth')
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
