'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import LoadingOverlay from '@/components/LoadingOverlay'

interface Store {
  id: string
  name: string
}

export default function CustomerLoginPage() {
  const [userId, setUserId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [store, setStore] = useState<Store | null>(null)
  const [storeLoading, setStoreLoading] = useState(true)
  
  const router = useRouter()
  const params = useParams()
  const storeName = params.storeName as string

  // Fetch store info
  useEffect(() => {
    const fetchStore = async () => {
      try {
        const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeName)}`)
        if (response.ok) {
          const data = await response.json()
          setStore(data)
        } else {
          setError('Store not found')
        }
      } catch (err) {
        setError('Failed to load store information')
      } finally {
        setStoreLoading(false)
      }
    }

    if (storeName) {
      fetchStore()
    }
  }, [storeName])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!store?.id) {
      setError('Store information not loaded. Please refresh the page.')
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/auth/customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId.trim(),
          storeId: store?.id
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok) {
        // Redirect to shop page
        router.push(`/${storeName}/shop`)
      } else {
        setError(data.message || 'Login failed')
      }
    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (storeLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900">
        <LoadingOverlay
          isVisible={true}
          title="Loading Store"
          message="Verifying store information..."
          color="blue"
        />
      </div>
    )
  }

  if (error && !store) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">Store Not Found</h1>
          <p className="text-gray-600 dark:text-slate-400">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 flex items-center justify-center p-4 relative overflow-hidden">
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
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
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
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              Welcome to {store?.name}
            </h2>
            <p className="text-slate-600 dark:text-slate-400">
              Enter your customer ID to shop
            </p>
          </div>
        </div>

        {/* Login Form Card */}
        <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20 dark:border-slate-700/50">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Customer ID
              </label>
              <input
                id="userId"
                type="text"
                required
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 shadow-sm hover:shadow-md"
                placeholder="Enter your customer ID"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !userId.trim() || !store?.id}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3 px-4 rounded-xl hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-slate-500 dark:text-slate-500">
            © 2024 BzPOS - Bazaar Point of Sale System
          </p>
        </div>

        <div className="text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Don't have a customer ID? Contact the store for assistance.
          </p>
        </div>
      </div>

      {/* Login Loading Overlay */}
      <LoadingOverlay
        isVisible={loading}
        title="Logging In"
        message="Verifying your customer ID..."
        color="blue"
      />
    </div>
  )
}
