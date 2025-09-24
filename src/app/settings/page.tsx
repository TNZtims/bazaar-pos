'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useToast } from '@/contexts/ToastContext'

interface StoreData {
  storeName: string
  isOnline: boolean
  isActive: boolean
}

export default function SettingsPage() {
  const { success, error } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [storeData, setStoreData] = useState<StoreData | null>(null)


  useEffect(() => {
    fetchStoreData()
  }, [])

  const fetchStoreData = async () => {
    try {
      const response = await fetch('/api/stores/status')
      if (response.ok) {
        const data = await response.json()
        setStoreData(data)
      } else {
        error('Failed to load store settings')
      }
    } catch (err) {
      console.error('Error fetching store data:', err)
      error('Failed to load store settings')
    } finally {
      setLoading(false)
    }
  }

  const handleOnlineStatusChange = async (isOnline: boolean) => {
    if (!storeData) return

    setSaving(true)
    try {
      const response = await fetch('/api/stores/status', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isOnline }),
      })

      if (response.ok) {
        const updatedData = await response.json()
        setStoreData(updatedData)
        success(`Store is now ${isOnline ? 'online' : 'offline'}`)
      } else {
        error('Failed to update store status')
      }
    } catch (err) {
      console.error('Error updating store status:', err)
      error('Failed to update store status')
    } finally {
      setSaving(false)
    }
  }


  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-slate-400">Loading settings...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  if (!storeData) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-slate-400">Failed to load store settings</p>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 px-4 sm:px-0">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Store Settings</h1>
            <p className="text-gray-600 dark:text-slate-400">Manage your store's online status</p>
          </div>

          {/* Online Status */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Store Status</h2>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-slate-100">Online Status</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  When offline, customers can only browse and preorder items
                </p>
              </div>
              
              <div className="flex items-center space-x-3">
                <span className={`text-sm font-medium ${
                  storeData.isOnline 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  {storeData.isOnline ? 'Online' : 'Offline'}
                </span>
                
                <button
                  onClick={() => handleOnlineStatusChange(!storeData.isOnline)}
                  disabled={saving}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    storeData.isOnline ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                  } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      storeData.isOnline ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

        </div>
      </Layout>
    </ProtectedRoute>
  )
}
