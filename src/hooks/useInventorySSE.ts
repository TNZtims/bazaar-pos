import { useState, useEffect, useCallback, useRef } from 'react'

interface InventoryUpdate {
  productId: string
  totalQuantity: number
  availableQuantity: number
  reservedQuantity: number
  updatedAt: string
}

interface UseInventorySSEOptions {
  productIds: string[]
  enabled?: boolean
}

interface UseInventorySSEReturn {
  updates: InventoryUpdate[]
  lastUpdate: string | null
  isConnected: boolean
  error: string | null
  reconnect: () => void
}

export function useInventorySSE({
  productIds,
  enabled = true
}: UseInventorySSEOptions): UseInventorySSEReturn {
  const [updates, setUpdates] = useState<InventoryUpdate[]>([])
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const eventSourceRef = useRef<EventSource>()
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  const reconnectAttemptsRef = useRef(0)
  const maxReconnectAttempts = 5

  const connect = useCallback(() => {
    if (!enabled || productIds.length === 0) return

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    try {
      const params = new URLSearchParams({
        products: productIds.join(',')
      })

      const eventSource = new EventSource(`/api/inventory/stream?${params}`)
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        console.log('SSE connection opened')
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
      }

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          
          if (data.type === 'initial' || data.type === 'update') {
            if (data.updates && Array.isArray(data.updates)) {
              setUpdates(data.updates)
              setLastUpdate(data.timestamp)
            }
          } else if (data.type === 'heartbeat') {
            // Just update last update time for heartbeat
            setLastUpdate(data.timestamp)
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err)
        }
      }

      eventSource.onerror = (event) => {
        console.error('SSE connection error:', event)
        setIsConnected(false)
        
        // Attempt to reconnect with exponential backoff
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000)
          reconnectAttemptsRef.current++
          
          setError(`Connection lost. Reconnecting in ${delay/1000}s... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, delay)
        } else {
          setError('Connection failed after multiple attempts. Please refresh the page.')
        }
      }
    } catch (err) {
      console.error('Error creating SSE connection:', err)
      setError('Failed to establish real-time connection')
    }
  }, [enabled, productIds])

  const reconnect = useCallback(() => {
    reconnectAttemptsRef.current = 0
    setError(null)
    connect()
  }, [connect])

  // Setup connection
  useEffect(() => {
    if (enabled && productIds.length > 0) {
      connect()
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [enabled, productIds, connect])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [])

  return {
    updates,
    lastUpdate,
    isConnected,
    error,
    reconnect
  }
}
