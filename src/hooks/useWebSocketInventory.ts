import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface InventoryUpdate {
  productId: string
  quantity?: number
  timestamp: string
}

interface ProductDeletedEvent {
  productId: string
  timestamp: string
}

interface UseWebSocketInventoryOptions {
  storeId: string | null
  enabled?: boolean
}

interface UseWebSocketInventoryReturn {
  socket: Socket | null
  updates: InventoryUpdate[]
  deletedProducts: string[]
  isConnected: boolean
  error: string | null
  broadcastInventoryUpdate: (productId: string, updates: Partial<InventoryUpdate>) => void
  broadcastCartUpdate: (productId: string, action: 'reserve' | 'release', quantity: number) => void
}

export function useWebSocketInventory({
  storeId,
  enabled = true
}: UseWebSocketInventoryOptions): UseWebSocketInventoryReturn {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [updates, setUpdates] = useState<InventoryUpdate[]>([])
  const [deletedProducts, setDeletedProducts] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled || !storeId) return

    console.log('Connecting to WebSocket...')
    
    const newSocket = io({
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      console.log('WebSocket connected')
      setIsConnected(true)
      setError(null)
      
      // Join store-specific room
      newSocket.emit('join-store', storeId)
    })

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
    })

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err)
      setError('Failed to connect to real-time updates')
      setIsConnected(false)
    })

    // Listen for inventory changes
    newSocket.on('inventory-changed', (data: InventoryUpdate) => {
      console.log('Received inventory update:', data)
      
      setUpdates(prevUpdates => {
        // Update existing or add new
        const existingIndex = prevUpdates.findIndex(update => update.productId === data.productId)
        
        if (existingIndex >= 0) {
          const newUpdates = [...prevUpdates]
          newUpdates[existingIndex] = { ...newUpdates[existingIndex], ...data }
          return newUpdates
        } else {
          return [...prevUpdates, data]
        }
      })
    })

    // Listen for cart changes (from other users)
    newSocket.on('cart-changed', (data: { productId: string, action: string, quantity: number }) => {
      console.log('Received cart update:', data)
      
      // Create inventory update based on cart action
      const inventoryUpdate: InventoryUpdate = {
        productId: data.productId,
        timestamp: new Date().toISOString()
      }
      
      // You might want to fetch the actual quantities from server here
      // For now, we'll let the periodic sync handle this
    })

    // Listen for product deletion
    newSocket.on('product-deleted', (data: ProductDeletedEvent) => {
      console.log('Received product deletion:', data)
      
      setDeletedProducts(prevDeleted => [...prevDeleted, data.productId])
      
      // Remove from updates as well
      setUpdates(prevUpdates => prevUpdates.filter(update => update.productId !== data.productId))
    })

    // Listen for order changes
    newSocket.on('order-changed', (data: any) => {
      console.log('Received order update:', data)
      // Handle order status changes if needed
    })

    setSocket(newSocket)

    return () => {
      console.log('Cleaning up WebSocket connection')
      newSocket.close()
      setSocket(null)
      setIsConnected(false)
    }
  }, [enabled, storeId])

  // Broadcast inventory update to other clients
  const broadcastInventoryUpdate = useCallback((productId: string, updates: Partial<InventoryUpdate>) => {
    if (socket && isConnected && storeId) {
      socket.emit('inventory-update', {
        storeId,
        productId,
        updates
      })
    }
  }, [socket, isConnected, storeId])

  // Broadcast cart update to other clients
  const broadcastCartUpdate = useCallback((productId: string, action: 'reserve' | 'release', quantity: number) => {
    if (socket && isConnected && storeId) {
      socket.emit('cart-update', {
        storeId,
        productId,
        action,
        quantity
      })
    }
  }, [socket, isConnected, storeId])

  return {
    socket,
    updates,
    deletedProducts,
    isConnected,
    error,
    broadcastInventoryUpdate,
    broadcastCartUpdate
  }
}
