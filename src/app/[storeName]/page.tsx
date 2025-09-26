'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function StoreIndexPage() {
  const params = useParams()
  const router = useRouter()
  const storeName = params.storeName as string

  useEffect(() => {
    // Check if store is accessible and redirect appropriately
    const checkStoreAndRedirect = async () => {
      try {
        const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeName)}`)
        
        if (response.ok) {
          // Store is open - redirect to shop
          router.push(`/${storeName}/shop`)
        } else if (response.status === 403) {
          // Store is closed - redirect to closed page
          router.push(`/${storeName}/closed`)
        } else {
          // Store not found - could redirect to a 404 page or show error
          router.push(`/${storeName}/shop`)
        }
      } catch (error) {
        console.error('Error checking store:', error)
        // Fallback to shop page
        router.push(`/${storeName}/shop`)
      }
    }

    checkStoreAndRedirect()
  }, [storeName, router])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-slate-400">Checking store status...</p>
      </div>
    </div>
  )
}
