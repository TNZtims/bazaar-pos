'use client'

import { useState, useEffect } from 'react'

interface StoreRatingSummaryProps {
  storeId: string
  storeName: string
  className?: string
}

interface RatingData {
  averageRating: number
  totalRatings: number
  ratings: Array<{
    _id: string
    rating: number
    userId: string
    createdAt: string
  }>
}

export default function StoreRatingSummary({ storeId, storeName, className = '' }: StoreRatingSummaryProps) {
  const [ratingData, setRatingData] = useState<RatingData>({
    averageRating: 0,
    totalRatings: 0,
    ratings: []
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRatings()
  }, [storeId])

  const fetchRatings = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/star-ratings?storeId=${storeId}`)
      if (response.ok) {
        const data = await response.json()
        setRatingData(data)
      } else {
        setError('Failed to fetch ratings')
      }
    } catch (error) {
      console.error('Error fetching ratings:', error)
      setError('Error fetching ratings')
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

  const getRatingText = (rating: number) => {
    if (rating >= 4.5) return 'Excellent'
    if (rating >= 3.5) return 'Good'
    if (rating >= 2.5) return 'Average'
    if (rating >= 1.5) return 'Poor'
    return 'Very Poor'
  }

  if (loading) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/3 mb-2"></div>
          <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-1/4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 ${className}`}>
        <div className="text-red-600 dark:text-red-400 text-sm">
          ⚠️ {error}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900 dark:text-slate-100">
          Customer Rating
        </h3>
        <button
          onClick={fetchRatings}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          title="Refresh ratings"
        >
          🔄 Refresh
        </button>
      </div>

      {ratingData.totalRatings > 0 ? (
        <div className="space-y-3">
          {/* Rating Display */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.round(ratingData.averageRating)
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
            <div className="flex items-center space-x-2">
              <span className={`text-lg font-bold ${getRatingColor(ratingData.averageRating)}`}>
                {ratingData.averageRating.toFixed(1)}
              </span>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                ({ratingData.totalRatings} rating{ratingData.totalRatings !== 1 ? 's' : ''})
              </span>
            </div>
          </div>

          {/* Rating Text */}
          <div className={`text-sm font-medium ${getRatingColor(ratingData.averageRating)}`}>
            {getRatingText(ratingData.averageRating)}
          </div>

          {/* Recent Ratings */}
          {ratingData.ratings.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                Recent Ratings:
              </div>
              <div className="space-y-1 max-h-20 overflow-y-auto">
                {ratingData.ratings.slice(0, 3).map((rating) => (
                  <div key={rating._id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <svg
                          key={star}
                          className={`w-3 h-3 ${
                            star <= rating.rating
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
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(rating.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <div className="text-gray-400 dark:text-gray-500 text-sm">
            ⭐ No ratings yet
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Customers haven't rated this store
          </div>
        </div>
      )}
    </div>
  )
}
