import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface InventoryUpdate {
  productId: string
  quantity?: number
  timestamp: string
  isNewProduct?: boolean
  productData?: any
}

interface ProductDeletedEvent {
  productId: string
  timestamp: string
}

interface UseWebSocketInventoryOptions {
  storeId: string | null
  enabled?: boolean
}

interface CartUpdate {
  productId: string
  action: 'reserve' | 'release'
  quantity: number
  timestamp: string
}

interface UseWebSocketInventoryReturn {
  socket: Socket | null
  updates: InventoryUpdate[]
  deletedProducts: string[]
  cartUpdates: CartUpdate[]
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
  const [cartUpdates, setCartUpdates] = useState<CartUpdate[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled || !storeId) return

    console.log('Connecting to WebSocket...')
    
    // Get the current host and protocol for WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${window.location.protocol}//${host}`
    
    console.log('WebSocket URL:', wsUrl)
    
    let newSocket: Socket | null = null
    
    try {
      newSocket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 3,
        forceNew: true
      })
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err)
      setError('WebSocket initialization failed')
      return
    }

    if (!newSocket) {
      console.error('WebSocket initialization returned null')
      setError('WebSocket not available')
      return
    }

    newSocket.on('connect', () => {
      console.log('🔗 WebSocket connected successfully')
      console.log('🏪 Joining store room:', storeId)
      setIsConnected(true)
      setError(null)
      clearTimeout(connectionTimeout)
      
      // Join store-specific room
      newSocket.emit('join-store', storeId)
      console.log('✅ Store join request sent')
    })

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected')
      setIsConnected(false)
    })

    newSocket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err)
      setError('Real-time updates unavailable (server connection failed)')
      setIsConnected(false)
      
      // Don't retry if it's a server connection issue
      if (err.message?.includes('xhr poll error') || err.message?.includes('websocket error')) {
        console.log('🚫 WebSocket server appears to be unavailable, disabling reconnection')
        newSocket.disconnect()
      }
    })

    // Add connection timeout
    const connectionTimeout = setTimeout(() => {
      if (!isConnected) {
        console.log('⏰ WebSocket connection timeout, giving up')
        setError('Real-time updates unavailable (connection timeout)')
        newSocket.disconnect()
      }
    }, 10000) // 10 second timeout

    newSocket.on('reconnect_error', (err) => {
      console.error('WebSocket reconnection error:', err)
      setError('Unable to reconnect to real-time updates')
    })

    newSocket.on('reconnect_failed', () => {
      console.error('WebSocket reconnection failed after maximum attempts')
      setError('Real-time updates unavailable - please refresh the page')
      setIsConnected(false)
    })

    // Listen for inventory changes
    newSocket.on('inventory-changed', (data: InventoryUpdate) => {
      console.log('🔔 WebSocket: Received inventory update:', data)
      
      setUpdates(prevUpdates => {
        // Update existing or add new
        const existingIndex = prevUpdates.findIndex(update => update.productId === data.productId)
        
        if (existingIndex >= 0) {
          const newUpdates = [...prevUpdates]
          newUpdates[existingIndex] = { ...newUpdates[existingIndex], ...data }
          console.log('📝 WebSocket: Updated existing product in updates array:', newUpdates[existingIndex])
          return newUpdates
        } else {
          console.log('➕ WebSocket: Added new product to updates array:', data)
          return [...prevUpdates, data]
        }
      })
    })

    // Listen for new product creation
    newSocket.on('product-created', (data: { product: any, timestamp: string }) => {
      console.log('🔔 WebSocket: Received product creation:', data)
      
      // Add the new product as an inventory update so existing logic can handle it
      const inventoryUpdate: InventoryUpdate = {
        productId: data.product._id,
        quantity: data.product.quantity,
        timestamp: data.timestamp,
        isNewProduct: true, // Flag to indicate this is a new product
        productData: data.product // Include full product data
      }
      
      setUpdates(prevUpdates => {
        // Check if product already exists
        const existingIndex = prevUpdates.findIndex(update => update.productId === data.product._id)
        
        if (existingIndex >= 0) {
          console.log('📝 WebSocket: Product already exists, updating:', data.product.name)
          const newUpdates = [...prevUpdates]
          newUpdates[existingIndex] = { ...newUpdates[existingIndex], ...inventoryUpdate }
          return newUpdates
        } else {
          console.log('➕ WebSocket: Added new product creation to updates array:', data.product.name)
          return [...prevUpdates, inventoryUpdate]
        }
      })
    })

    // Listen for cart changes (from other users)
    newSocket.on('cart-changed', (data: { productId: string, action: string, quantity: number, timestamp?: string }) => {
      console.log('Received cart update:', data)
      
      const cartUpdate: CartUpdate = {
        productId: data.productId,
        action: data.action as 'reserve' | 'release',
        quantity: data.quantity,
        timestamp: data.timestamp || new Date().toISOString()
      }
      
      setCartUpdates(prevUpdates => {
        // Keep only the latest update per product
        const filtered = prevUpdates.filter(update => update.productId !== data.productId)
        return [...filtered, cartUpdate]
      })
      
      // Also trigger inventory update for real-time availability calculation
      const inventoryUpdate: InventoryUpdate = {
        productId: data.productId,
        timestamp: cartUpdate.timestamp
      }
      
      setUpdates(prevUpdates => {
        const existingIndex = prevUpdates.findIndex(update => update.productId === data.productId)
        if (existingIndex >= 0) {
          const newUpdates = [...prevUpdates]
          newUpdates[existingIndex] = { ...newUpdates[existingIndex], ...inventoryUpdate }
          return newUpdates
        } else {
          return [...prevUpdates, inventoryUpdate]
        }
      })
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
      clearTimeout(connectionTimeout)
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
    cartUpdates,
    isConnected,
    error,
    broadcastInventoryUpdate,
    broadcastCartUpdate
  }
}
