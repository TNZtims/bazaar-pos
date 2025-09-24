'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function LegacyLoginRedirect() {
  const params = useParams()
  const router = useRouter()
  const storeId = params.storeId as string

  useEffect(() => {
    const redirectToNewUrl = async () => {
      try {
        const response = await fetch(`/api/stores/public/${storeId}`)
        if (response.ok) {
          const data = await response.json()
          const encodedStoreName = encodeURIComponent(data.name)
          router.replace(`/${encodedStoreName}/login`)
        } else {
          router.replace('/')
        }
      } catch (error) {
        router.replace('/')
      }
    }

    if (storeId) {
      redirectToNewUrl()
    }
  }, [storeId, router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to store...</p>
      </div>
    </div>
  )
}