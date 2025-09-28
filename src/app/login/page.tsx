'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import ErrorBoundary from '@/components/ErrorBoundary'

interface Store {
  id: string
  storeName: string
  displayName: string
  cashiers: string[]
  isLocked: boolean
}

function LoginPageContent() {
  const router = useRouter()
  const { login, isAuthenticated, loading } = useAuth()
  const { success, error: showError } = useToast()
  
  const [formData, setFormData] = useState({
    storeName: '',
    password: '',
    selectedCashier: ''
  })
  const [isLoading, setIsLoading] = useState(false)
  const [availableStores, setAvailableStores] = useState<Store[]>([])
  const [availableCashiers, setAvailableCashiers] = useState<string[]>([])
  const [loadingStores, setLoadingStores] = useState(true)
  const [loadingCashiers, setLoadingCashiers] = useState(false)
  // Setup functionality removed for security - stores must be created by admins

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, loading, router])

  // Load available stores on component mount
  useEffect(() => {
    const loadStores = async () => {
      setLoadingStores(true)
      try {
        const response = await fetch('/api/stores/list', {
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
        if (response.ok) {
          const data = await response.json()
          setAvailableStores(data.stores || [])
        } else {
          console.error('Failed to load stores:', response.status)
        }
      } catch (err) {
        console.error('Error loading stores:', err)
      } finally {
        setLoadingStores(false)
      }
    }

    loadStores()
  }, []) // Remove error dependency to prevent infinite loops

  // Load cashiers when store is selected
  useEffect(() => {
    if (!formData.storeName.trim()) {
      setAvailableCashiers([])
      setFormData(prev => ({ ...prev, selectedCashier: '' }))
      return
    }

    // Find the selected store and get its cashiers
    const selectedStore = availableStores.find(store => store.storeName === formData.storeName)
    if (selectedStore) {
      setAvailableCashiers(selectedStore.cashiers || [])
      setFormData(prev => ({ ...prev, selectedCashier: '' }))
    } else {
      setAvailableCashiers([])
      setFormData(prev => ({ ...prev, selectedCashier: '' }))
    }
  }, [formData.storeName, availableStores])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.storeName || !formData.password) {
      showError('Please fill in all fields')
      return
    }

    if (!formData.selectedCashier) {
      showError('Please select a cashier')
      return
    }
    
    setIsLoading(true)
    
    const result = await login(formData.storeName, formData.password, formData.selectedCashier)
    
    setIsLoading(false)
    
    if (result.success) {
      success('Login successful!')
      router.push('/')
    } else {
      showError(result.message)
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4 py-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            🏪 POS System
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-400">
            Sign in to your store
          </p>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-700">
          <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Store *
                </label>
                <select
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loadingStores}
                >
                  <option value="">
                    {loadingStores ? 'Loading stores...' : 'Select Store'}
                  </option>
                  {availableStores.map((store) => (
                    <option key={store.id} value={store.storeName}>
                      {store.displayName} {store.isLocked ? '(Closed)' : ''}
                    </option>
                  ))}
                </select>
                {availableStores.length === 0 && !loadingStores && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                    No active stores found. Please contact your administrator.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Cashier *
                </label>
                <select
                  required
                  value={formData.selectedCashier}
                  onChange={(e) => setFormData({ ...formData, selectedCashier: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!formData.storeName || loadingCashiers || availableCashiers.length === 0}
                >
                  <option value="">
                    {!formData.storeName ? 'Select a store first' :
                     loadingCashiers ? 'Loading cashiers...' : 
                     availableCashiers.length === 0 ? 'No cashiers available' : 
                     'Select Cashier'}
                  </option>
                  {availableCashiers.map((cashier) => (
                    <option key={cashier} value={cashier}>
                      {cashier}
                    </option>
                  ))}
                </select>
                {availableCashiers.length === 0 && formData.storeName && !loadingCashiers && (
                  <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                    No cashiers found for this store. Please contact your administrator.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>

              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Don&apos;t have a store account? 
                  <br />
                  <span className="text-xs text-gray-500 dark:text-gray-500">
                    Contact your system administrator to create a new store.
                  </span>
                </p>
              </div>
            </form>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <ErrorBoundary>
      <LoginPageContent />
    </ErrorBoundary>
  )
}
