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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center p-4 py-8 relative overflow-hidden">
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-80 dark:opacity-60"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='1920' height='1080' viewBox='0 0 1920 1080' xmlns='http://www.w3.org/2000/svg'%3E%3Cdefs%3E%3ClinearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'%3E%3Cstop offset='0%25' style='stop-color:%236366f1;stop-opacity:0.25' /%3E%3Cstop offset='50%25' style='stop-color:%234f46e5;stop-opacity:0.35' /%3E%3Cstop offset='100%25' style='stop-color:%237c3aed;stop-opacity:0.25' /%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='1920' height='1080' fill='url(%23bg)' /%3E%3Cg opacity='0.6'%3E%3Ccircle cx='200' cy='200' r='100' fill='%236366f1' opacity='0.25'/%3E%3Ccircle cx='1720' cy='300' r='150' fill='%234f46e5' opacity='0.2'/%3E%3Ccircle cx='400' cy='800' r='120' fill='%237c3aed' opacity='0.25'/%3E%3Ccircle cx='1500' cy='900' r='80' fill='%236366f1' opacity='0.3'/%3E%3Ccircle cx='800' cy='150' r='200' fill='%234f46e5' opacity='0.15'/%3E%3Ccircle cx='1200' cy='700' r='180' fill='%237c3aed' opacity='0.2'/%3E%3C/g%3E%3Cg opacity='0.5'%3E%3Cpath d='M0,0 L1920,0 L1920,200 L0,300 Z' fill='%236366f1' opacity='0.15'/%3E%3Cpath d='M0,880 L1920,780 L1920,1080 L0,1080 Z' fill='%234f46e5' opacity='0.15'/%3E%3C/g%3E%3C/svg%3E")`
        }}
      ></div>
      
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-indigo-400/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-400/5 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header Section */}
        <div className="text-center space-y-4">
          {/* Logo/Brand */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-2xl">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          
          {/* Title */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              BzPOS
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 font-medium">
              Bazaar Point of Sale
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-500">
              Sign in to your store
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20 dark:border-slate-700/50">
          <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Store *
                </label>
                <select
                  required
                  value={formData.storeName}
                  onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
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
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
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
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
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
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>

              <div className="text-center pt-4 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Don&apos;t have a store account? 
                  <br />
                  <span className="text-xs text-slate-500 dark:text-slate-500">
                    Contact your system administrator to create a new store.
                  </span>
                </p>
              </div>
            </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-500">
            © 2024 BzPOS - Bazaar Point of Sale System
          </p>
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
