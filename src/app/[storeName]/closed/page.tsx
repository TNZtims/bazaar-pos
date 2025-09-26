'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function StoreClosedPage() {
  const [isChecking, setIsChecking] = useState(false)
  const [storeName, setStoreName] = useState('')
  const params = useParams()
  const router = useRouter()
  const storeNameParam = params.storeName as string

  useEffect(() => {
    setStoreName(storeNameParam)
    
    // Check store status every 10 seconds
    const checkStoreStatus = async () => {
      try {
        setIsChecking(true)
        const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeNameParam)}`, {
          // Prevent fetch from logging errors to console
          cache: 'no-cache'
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.accessible) {
            console.log(`🎉 Store "${storeNameParam}" is now open - redirecting to shop`)
            // Store is now open! Redirect to shop
            router.push(`/${storeNameParam}/shop`)
          } else {
            console.log(`🏪 Store "${storeNameParam}" is still closed`)
          }
        } else {
          console.log(`⚠️ Store "${storeNameParam}" status check returned: ${response.status}`)
        }
      } catch (error) {
        console.log(`⚠️ Unable to check store "${storeNameParam}" status - network error`)
      } finally {
        setIsChecking(false)
      }
    }

    // Initial check
    checkStoreStatus()
    
    // Set up interval to check every 10 seconds
    const interval = setInterval(checkStoreStatus, 10000)
    
    // Cleanup interval on unmount
    return () => clearInterval(interval)
  }, [storeNameParam, router])

  const handleRetry = async () => {
    setIsChecking(true)
    try {
      const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeNameParam)}`, {
        // Prevent fetch from logging errors to console
        cache: 'no-cache'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.accessible) {
          console.log(`🎉 Store "${storeNameParam}" is now open - redirecting to shop`)
          // Store is now open! Redirect to shop
          router.push(`/${storeNameParam}/shop`)
        } else {
          console.log(`🏪 Store "${storeNameParam}" is still closed`)
        }
      } else {
        console.log(`⚠️ Store "${storeNameParam}" status check returned: ${response.status}`)
      }
    } catch (error) {
      console.log(`⚠️ Unable to check store "${storeNameParam}" status - network error`)
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center p-4">
      {/* Fixed Modal Overlay */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        
        {/* Modal Content */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-8 shadow-2xl border border-gray-200 dark:border-slate-700 transform animate-in zoom-in-95 duration-300">
          
          {/* Store Closed Icon */}
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-5V9m0 0V7m0 2h2m-2 0H10M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-2">
              Store Temporarily Closed
            </h1>
            <p className="text-gray-600 dark:text-slate-400 text-lg">
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {storeName}
              </span> is currently closed
            </p>
          </div>

          {/* Message */}
          <div className="text-center mb-8">
            <p className="text-gray-700 dark:text-slate-300 mb-4">
              We're temporarily unavailable for new orders. Please check back later or contact us directly.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="text-blue-800 dark:text-blue-300 text-sm">
                💡 This page will automatically redirect you when the store reopens
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              disabled={isChecking}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              {isChecking ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Check Again</span>
                </>
              )}
            </button>
            
            <button
              onClick={() => window.history.back()}
              className="w-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 py-3 px-4 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
            >
              Go Back
            </button>
          </div>

          {/* Auto-refresh indicator */}
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-slate-700">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-slate-400">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span>Auto-checking every 10 seconds</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
