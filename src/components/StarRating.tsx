'use client'

import { useState, useEffect } from 'react'

interface StarRatingProps {
  storeId: string
  className?: string
  user?: {
    id: string
    customId: string
    name: string
  } | null
}

interface RatingData {
  averageRating: number
  totalRatings: number
  userRating: number | null
}

export default function StarRating({ storeId, className = '', user }: StarRatingProps) {
  const [ratingData, setRatingData] = useState<RatingData>({
    averageRating: 0,
    totalRatings: 0,
    userRating: null
  })
  const [hoveredStar, setHoveredStar] = useState(0)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchRatings()
  }, [storeId])

  const fetchRatings = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/star-ratings?storeId=${storeId}`, {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setRatingData(data)
      }
    } catch (error) {
      console.error('Error fetching ratings:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStarClick = async (rating: number) => {
    if (!user) {
      alert('Please login to rate this store')
      return
    }

    try {
      setSubmitting(true)
      const response = await fetch('/api/star-ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ storeId, rating })
      })

      if (response.ok) {
        const data = await response.json()
        setRatingData(prev => ({
          ...prev,
          averageRating: data.averageRating,
          totalRatings: data.totalRatings,
          userRating: rating
        }))
      } else {
        const errorData = await response.json()
        alert(errorData.message || 'Error saving rating')
      }
    } catch (error) {
      console.error('Error saving rating:', error)
      alert('Error saving rating')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveRating = async () => {
    if (!user) return

    try {
      setSubmitting(true)
      const response = await fetch(`/api/star-ratings?storeId=${storeId}`, {
        method: 'DELETE',
        credentials: 'include'
      })

      if (response.ok) {
        const data = await response.json()
        setRatingData(prev => ({
          ...prev,
          averageRating: data.averageRating,
          totalRatings: data.totalRatings,
          userRating: null
        }))
      }
    } catch (error) {
      console.error('Error removing rating:', error)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <div
              key={star}
              className="w-8 h-8 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"
            />
          ))}
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">Loading...</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Star Rating */}
      <div className="flex items-center space-x-2">
        {[1, 2, 3, 4, 5].map((star) => {
          const isActive = star <= (hoveredStar || ratingData.userRating || 0)
          const isHovered = star <= hoveredStar
          
          return (
            <button
              key={star}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              disabled={submitting}
              className={`w-8 h-8 transition-colors duration-200 ${
                isActive || isHovered
                  ? 'text-yellow-400 hover:text-yellow-500'
                  : 'text-gray-300 dark:text-gray-600 hover:text-yellow-300'
              } ${submitting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              title={`Rate ${star} star${star > 1 ? 's' : ''}`}
            >
              <svg
                className="w-full h-full fill-current"
                viewBox="0 0 24 24"
              >
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
              </svg>
            </button>
          )
        })}
      </div>

      {/* Rating Info */}
      <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
        <span className="font-medium">
          {ratingData.averageRating > 0 ? ratingData.averageRating.toFixed(1) : '0.0'}
        </span>
        <span>({ratingData.totalRatings} rating{ratingData.totalRatings !== 1 ? 's' : ''})</span>
        
        {ratingData.userRating && (
          <button
            onClick={handleRemoveRating}
            disabled={submitting}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
          >
            Remove my rating
          </button>
        )}
      </div>

      {/* User Rating Indicator */}
      {ratingData.userRating && (
        <div className="text-xs text-blue-600 dark:text-blue-400">
          Your rating: {ratingData.userRating} star{ratingData.userRating > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}
