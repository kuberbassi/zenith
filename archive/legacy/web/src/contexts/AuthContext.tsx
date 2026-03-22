'use client'

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import { authApi } from '@/lib/api'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credential: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Restore session from localStorage
  useEffect(() => {
    const savedToken = localStorage.getItem('acadhub_token')
    const savedUser = localStorage.getItem('acadhub_user')

    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem('acadhub_token')
        localStorage.removeItem('acadhub_user')
      }
    }
    setIsLoading(false)
  }, [])

  const login = useCallback(async (credential: string) => {
    setIsLoading(true)
    try {
      const res = await authApi.googleLogin(credential)
      const { token: newToken, user: newUser } = res.data
      setToken(newToken)
      setUser(newUser)
      localStorage.setItem('acadhub_token', newToken)
      localStorage.setItem('acadhub_user', JSON.stringify(newUser))
    } catch (err) {
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    localStorage.removeItem('acadhub_token')
    localStorage.removeItem('acadhub_user')
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
