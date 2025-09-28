'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface Store {
  id: string
  storeName: string
  isAdmin: boolean
  cashiers: string[]
  selectedCashier?: string
}

interface AuthContextType {
  store: Store | null
  login: (storeName: string, password: string, selectedCashier?: string) => Promise<{ success: boolean; message: string }>
  logout: () => Promise<void>
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)

  // Check authentication status on mount
  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    // Use localStorage to track if we've already determined user is not logged in
    const wasLoggedOut = localStorage.getItem('auth-status') === 'logged-out'
    
    if (wasLoggedOut) {
      setStore(null)
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setStore(data.store)
        localStorage.setItem('auth-status', 'logged-in')
      } else if (response.status === 401) {
        // User is not authenticated
        setStore(null)
        localStorage.setItem('auth-status', 'logged-out')
      } else {
        // Other error
        setStore(null)
        localStorage.removeItem('auth-status')
      }
    } catch (error) {
      setStore(null)
      localStorage.removeItem('auth-status')
    } finally {
      setLoading(false)
    }
  }

  const login = async (storeName: string, password: string, selectedCashier?: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ storeName, password, selectedCashier }),
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok) {
        setStore(data.store)
        localStorage.setItem('auth-status', 'logged-in')
        return { success: true, message: data.message }
      } else {
        localStorage.setItem('auth-status', 'logged-out')
        return { success: false, message: data.message }
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, message: 'Login failed. Please try again.' }
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setStore(null)
      localStorage.setItem('auth-status', 'logged-out')
    }
  }

  const value: AuthContextType = {
    store,
    login,
    logout,
    loading,
    isAuthenticated: !!store,
    isAdmin: store?.isAdmin || false
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthProvider
