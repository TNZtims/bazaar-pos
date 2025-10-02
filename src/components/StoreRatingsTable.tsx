'use client'

import { useState, useEffect } from 'react'

interface StoreRatingsTableProps {
  className?: string
}

interface RatingData {
  _id: string
  rating: number
  userId: {
    _id: string
    name: string
    email: string
  }
  createdAt: string
  storeId: string
}

interface StoreRatingSummary {
  storeId: string
  storeName: string
  averageRating: number
  totalRatings: number
  ratings: RatingData[]
}

export default function StoreRatingsTable({ className = '' }: StoreRatingsTableProps) {
  const [ratingsData, setRatingsData] = useState<StoreRatingSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStore, setSelectedStore] = useState<string | null>(null)

  useEffect(() => {
    fetchAllRatings()
  }, [])

  const fetchAllRatings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // First, get all stores
      const storesResponse = await fetch('/api/admin/stores')
      if (!storesResponse.ok) {
        throw new Error('Failed to fetch stores')
      }
      
      const storesData = await storesResponse.json()
      const stores = storesData.stores || []
      
      // Then fetch ratings for each store
      const ratingsPromises = stores.map(async (store: any) => {
        try {
          const ratingsResponse = await fetch(`/api/star-ratings?storeId=${store._id}`)
          if (ratingsResponse.ok) {
            const ratingsData = await ratingsResponse.json()
            return {
              storeId: store._id,
              storeName: store.storeName,
              averageRating: ratingsData.averageRating || 0,
              totalRatings: ratingsData.totalRatings || 0,
              ratings: ratingsData.ratings || []
            }
          }
          return {
            storeId: store._id,
            storeName: store.storeName,
            averageRating: 0,
            totalRatings: 0,
            ratings: []
          }
        } catch (error) {
          console.error(`Error fetching ratings for store ${store.storeName}:`, error)
          return {
            storeId: store._id,
            storeName: store.storeName,
            averageRating: 0,
            totalRatings: 0,
            ratings: []
          }
        }
      })
      
      const allRatings = await Promise.all(ratingsPromises)
      setRatingsData(allRatings)
    } catch (error) {
      console.error('Error fetching ratings:', error)
      setError('Failed to fetch ratings data')
    } finally {
      setLoading(false)
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600 dark:text-green-400'
    if (rating >= 3.5) return 'text-yellow-600 dark:text-yellow-400'
    if (rating >= 2.5) return 'text-orange-600 dark:text-orange-400'
    return 'text-red-600 dark:text-red-400'
  }

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm') => {
    const starSize = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'
    return (
      <div className="flex items-center space-x-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`${starSize} ${
              star <= rating
                ? 'text-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 ${className}`}>
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-4"></div>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 ${className}`}>
        <div className="p-6">
          <div className="text-red-600 dark:text-red-400 text-center">
            ⚠️ {error}
            <button
              onClick={fetchAllRatings}
              className="ml-2 text-blue-600 dark:text-blue-400 hover:underline"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  const totalRatings = ratingsData.reduce((sum, store) => sum + store.totalRatings, 0)
  const storesWithRatings = ratingsData.filter(store => store.totalRatings > 0)

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              All Store Ratings
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {totalRatings} total ratings across {storesWithRatings.length} stores
            </p>
          </div>
          <button
            onClick={fetchAllRatings}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1"
          >
            🔄 Refresh
          </button>
        </div>

        {storesWithRatings.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 dark:text-gray-500 text-lg mb-2">
              ⭐ No ratings yet
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Customers haven't rated any stores
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {ratingsData.map((store) => (
              <div key={store.storeId} className="border border-gray-200 dark:border-slate-600 rounded-lg p-4">
                {/* Store Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <h4 className="text-md font-medium text-gray-900 dark:text-slate-100">
                      {store.storeName}
                    </h4>
                    <div className="flex items-center space-x-2">
                      {renderStars(Math.round(store.averageRating), 'md')}
                      <span className={`text-sm font-medium ${getRatingColor(store.averageRating)}`}>
                        {store.averageRating.toFixed(1)}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        ({store.totalRatings} rating{store.totalRatings !== 1 ? 's' : ''})
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedStore(selectedStore === store.storeId ? null : store.storeId)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                  >
                    {selectedStore === store.storeId ? 'Hide Details' : 'Show Details'}
                  </button>
                </div>

                {/* Store Ratings Table */}
                {selectedStore === store.storeId && store.ratings.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-600">
                      <thead className="bg-gray-50 dark:bg-slate-700">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                            Rating
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                            Customer
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                            Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-600">
                        {store.ratings.map((rating) => (
                          <tr key={rating._id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center space-x-2">
                                {renderStars(rating.rating)}
                                <span className={`text-sm font-medium ${getRatingColor(rating.rating)}`}>
                                  {rating.rating} star{rating.rating !== 1 ? 's' : ''}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-900 dark:text-slate-100">
                                {rating.userId?.name || 'Anonymous'}
                              </div>
                              {rating.userId?.email && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {rating.userId.email}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                              {new Date(rating.createdAt).toLocaleDateString()} at{' '}
                              {new Date(rating.createdAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {selectedStore === store.storeId && store.ratings.length === 0 && (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    No individual ratings to display
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
