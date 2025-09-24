import { useState, useEffect, useCallback, useRef } from 'react'

interface InventoryUpdate {
  productId: string
  quantity: number
}

interface UseInventoryPollingParams {
  storeId: string | null
  productIds?: string[]
  enabled?: boolean
  pollInterval?: number
}

export function useInventoryPolling({
  storeId,
  productIds = [],
  enabled = true,
  pollInterval = 10000 // 10 seconds default
}: UseInventoryPollingParams) {
  const [updates, setUpdates] = useState<InventoryUpdate[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastUpdateTime = useRef<number>(Date.now())

  const fetchUpdates = useCallback(async () => {
    if (!enabled || !storeId || productIds.length === 0) {
      return
    }

    try {
      const response = await fetch(
        `/api/inventory/updates?productIds=${productIds.join(',')}`,
        {
          credentials: 'include'
        }
      )

      if (response.ok) {
        const data = await response.json()
        setUpdates(data.updates || [])
        setIsConnected(true)
        setError(null)
        lastUpdateTime.current = Date.now()
      } else {
        setError('Failed to fetch inventory updates')
        setIsConnected(false)
      }
    } catch (err) {
      setError('Network error fetching inventory updates')
      setIsConnected(false)
      console.error('Inventory polling error:', err)
    }
  }, [enabled, storeId, productIds])

  // Manual refresh function
  const forceUpdate = useCallback(() => {
    fetchUpdates()
  }, [fetchUpdates])

  // Simulate cart update broadcast for consistency with WebSocket API
  const broadcastCartUpdate = useCallback(() => {
    // Since we're using polling, we'll just trigger a faster update
    forceUpdate()
  }, [forceUpdate])

  useEffect(() => {
    if (!enabled || !storeId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setIsConnected(false)
      return
    }

    // Initial fetch
    fetchUpdates()

    // Set up polling interval
    intervalRef.current = setInterval(fetchUpdates, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [enabled, storeId, fetchUpdates, pollInterval])

  return {
    updates,
    isConnected,
    error,
    forceUpdate,
    broadcastCartUpdate
  }
}
