import { useState, useEffect, useCallback, useRef } from 'react'

interface InventoryUpdate {
  productId: string
  totalQuantity: number
  availableQuantity: number
  reservedQuantity: number
  updatedAt: string
}

interface UseInventoryUpdatesOptions {
  productIds: string[]
  pollInterval?: number
  enabled?: boolean
}

interface UseInventoryUpdatesReturn {
  updates: InventoryUpdate[]
  lastUpdate: string | null
  isPolling: boolean
  error: string | null
  forceUpdate: () => void
}

export function useInventoryUpdates({
  productIds,
  pollInterval = 5000, // 5 seconds
  enabled = true
}: UseInventoryUpdatesOptions): UseInventoryUpdatesReturn {
  const [updates, setUpdates] = useState<InventoryUpdate[]>([])
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const pollTimeoutRef = useRef<NodeJS.Timeout>()
  const abortControllerRef = useRef<AbortController>()

  const fetchUpdates = useCallback(async (force = false) => {
    if (!enabled || productIds.length === 0) return

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    
    try {
      setIsPolling(true)
      setError(null)

      const params = new URLSearchParams({
        products: productIds.join(',')
      })

      // Only include lastUpdate if not forcing and we have a previous timestamp
      if (!force && lastUpdate) {
        params.append('lastUpdate', lastUpdate)
      }

      const response = await fetch(`/api/inventory/updates?${params}`, {
        signal: abortControllerRef.current.signal,
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      if (data.updates && data.updates.length > 0) {
        setUpdates(prevUpdates => {
          // Merge new updates with existing ones
          const updatedMap = new Map(
            prevUpdates.map(update => [update.productId, update])
          )
          
          data.updates.forEach((update: InventoryUpdate) => {
            updatedMap.set(update.productId, update)
          })
          
          return Array.from(updatedMap.values())
        })
      }

      setLastUpdate(data.timestamp)
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Error fetching inventory updates:', err)
        setError(err.message || 'Failed to fetch inventory updates')
      }
    } finally {
      setIsPolling(false)
    }
  }, [enabled, productIds, lastUpdate])

  const forceUpdate = useCallback(() => {
    fetchUpdates(true)
  }, [fetchUpdates])

  // Initial fetch and polling setup
  useEffect(() => {
    if (!enabled || productIds.length === 0) return

    // Initial fetch
    fetchUpdates(true)

    // Set up polling
    const setupPolling = () => {
      pollTimeoutRef.current = setTimeout(() => {
        fetchUpdates().then(() => {
          if (enabled) {
            setupPolling()
          }
        })
      }, pollInterval)
    }

    setupPolling()

    // Cleanup
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [enabled, productIds, pollInterval, fetchUpdates])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    updates,
    lastUpdate,
    isPolling,
    error,
    forceUpdate
  }
}

// Helper hook for updating inventory in real-time
export function useInventoryActions() {
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const batchUpdateInventory = useCallback(async (updates: Array<{
    productId: string
    operation: 'reserve' | 'release' | 'deduct' | 'add'
    quantity: number
    reason?: string
  }>) => {
    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch('/api/inventory/updates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
        credentials: 'include'
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Check if any updates failed
      const failedUpdates = data.results.filter((result: any) => !result.success)
      if (failedUpdates.length > 0) {
        const errors = failedUpdates.map((result: any) => 
          `${result.productId}: ${result.error}`
        ).join(', ')
        throw new Error(`Some updates failed: ${errors}`)
      }

      return data.results
    } catch (err: any) {
      console.error('Error updating inventory:', err)
      setError(err.message || 'Failed to update inventory')
      throw err
    } finally {
      setIsUpdating(false)
    }
  }, [])

  return {
    batchUpdateInventory,
    isUpdating,
    error
  }
}
