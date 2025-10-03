import { useEffect, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

interface InventoryUpdate {
  productId: string
  quantity?: number
  initialStock?: number
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
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected'
  reconnectAttempts: number
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
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor' | 'disconnected'>('disconnected')
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [lastPingTime, setLastPingTime] = useState<number>(0)
  const [reconnectTimeoutId, setReconnectTimeoutId] = useState<NodeJS.Timeout | null>(null)

  // Exponential backoff calculation
  const getReconnectDelay = (attempt: number) => {
    const baseDelay = 1000 // 1 second
    const maxDelay = 30000 // 30 seconds
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000
  }

  // Connection quality monitoring
  const updateConnectionQuality = (latency: number) => {
    if (latency < 100) {
      setConnectionQuality('excellent')
    } else if (latency < 300) {
      setConnectionQuality('good')
    } else if (latency < 1000) {
      setConnectionQuality('poor')
    } else {
      setConnectionQuality('disconnected')
    }
  }

  // Heartbeat mechanism
  const startHeartbeat = (socket: Socket) => {
    const heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        const pingTime = Date.now()
        setLastPingTime(pingTime)
        socket.emit('ping', pingTime)
      }
    }, 10000) // Ping every 10 seconds

    return heartbeatInterval
  }

  // Initialize WebSocket connection with enhanced stability
  const initializeWebSocket = useCallback(() => {
    if (!enabled || !storeId) return null

    console.log(`🔄 Connecting to WebSocket... (attempt ${reconnectAttempts + 1})`)
    
    // Get the current host and protocol for WebSocket connection
    const wsUrl = `${window.location.protocol}//${window.location.host}`
    
    console.log('WebSocket URL:', wsUrl)
    
    let newSocket: Socket | null = null
    
    try {
      newSocket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        timeout: 30000,
        reconnection: true,
        reconnectionDelay: 5000,
        reconnectionAttempts: 5,
        forceNew: true,
        upgrade: true,
        withCredentials: false,
        autoConnect: true,
        rememberUpgrade: true
      })
    } catch (err) {
      console.error('Failed to initialize WebSocket:', err)
      setError('WebSocket initialization failed')
      return null
    }

    if (!newSocket) {
      console.error('WebSocket initialization returned null')
      setError('WebSocket not available')
      return null
    }

    return newSocket
  }, [enabled, storeId, reconnectAttempts])

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled || !storeId) return

    const newSocket = initializeWebSocket()
    if (!newSocket) return

    // Start heartbeat mechanism
    const heartbeatInterval = startHeartbeat(newSocket)

    newSocket.on('connect', () => {
      console.log('🔗 WebSocket connected successfully')
      console.log('🏪 Joining store room:', storeId)
      setIsConnected(true)
      setError(null)
      setReconnectAttempts(0) // Reset attempts on successful connection
      setConnectionQuality('excellent')
      
      // Join store-specific room
      newSocket.emit('join-store', storeId)
      console.log('✅ Store join request sent')
    })

    newSocket.on('disconnect', (reason) => {
      console.log('🔌 WebSocket disconnected:', reason)
      setIsConnected(false)
      setConnectionQuality('disconnected')
      
      // Don't increment attempts for client-initiated disconnects
      if (reason !== 'io client disconnect') {
        setReconnectAttempts(prev => prev + 1)
      }
    })

    newSocket.on('connect_error', (err) => {
      console.error('❌ WebSocket connection error:', err)
      console.error('❌ Error details:', {
        message: err.message,
        description: err.description,
        context: err.context,
        type: err.type
      })
      setIsConnected(false)
      setConnectionQuality('disconnected')
      setReconnectAttempts(prev => prev + 1)
      
      // Set error message based on attempt count
      if (reconnectAttempts < 3) {
        setError('Reconnecting to real-time updates...')
      } else if (reconnectAttempts < 10) {
        setError('Connection unstable, retrying...')
      } else {
        setError('Real-time updates temporarily unavailable')
      }
      
      // Handle specific error types
      if (err.message?.includes('xhr post error') || 
          err.message?.includes('400') || 
          err.description === 400 ||
          err.type === 'TransportError') {
        console.log('🚫 WebSocket transport error detected, will retry with different transport')
        // Don't disconnect immediately, let Socket.IO handle transport fallback
      } else if (err.message?.includes('websocket error') || err.message?.includes('server error')) {
        console.log('🚫 WebSocket server appears to be unavailable, disabling reconnection')
        newSocket.disconnect()
      }
    })

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('🔄 WebSocket reconnected after', attemptNumber, 'attempts')
      setReconnectAttempts(0)
      setError(null)
      setConnectionQuality('good')
    })

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('🔄 WebSocket reconnection attempt:', attemptNumber)
      setError(`Reconnecting... (attempt ${attemptNumber})`)
    })

    newSocket.on('reconnect_error', (err) => {
      console.error('🔄❌ WebSocket reconnection error:', err)
      setReconnectAttempts(prev => prev + 1)
    })

    newSocket.on('reconnect_failed', () => {
      console.error('🔄❌ WebSocket reconnection failed after maximum attempts')
      setError('Unable to establish real-time connection')
      setIsConnected(false)
      setConnectionQuality('disconnected')
    })

    // Handle pong responses for latency monitoring
    newSocket.on('pong', (pingTime: number) => {
      const latency = Date.now() - pingTime
      updateConnectionQuality(latency)
      console.log(`🏓 WebSocket latency: ${latency}ms`)
    })

    // Handle server-initiated ping
    newSocket.on('ping', () => {
      newSocket.emit('pong')
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

    // Listen for product updates (including discount price changes)
    newSocket.on('product-updated', (data: { product: any, timestamp: string }) => {
      console.log('🔔 WebSocket: Received product update:', data)
      
      // Add the updated product as an inventory update so existing logic can handle it
      const inventoryUpdate: InventoryUpdate = {
        productId: data.product._id,
        quantity: data.product.quantity,
        initialStock: data.product.initialStock,
        timestamp: data.timestamp,
        isNewProduct: false, // This is an existing product update
        productData: data.product // Include full product data with discount price
      }
      
      setUpdates(prevUpdates => {
        // Update existing or add new
        const existingIndex = prevUpdates.findIndex(update => update.productId === data.product._id)
        
        if (existingIndex >= 0) {
          console.log('📝 WebSocket: Updating existing product:', data.product.name, 'discountPrice:', data.product.discountPrice)
          const newUpdates = [...prevUpdates]
          newUpdates[existingIndex] = { ...newUpdates[existingIndex], ...inventoryUpdate }
          return newUpdates
        } else {
          console.log('➕ WebSocket: Added product update to updates array:', data.product.name)
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
      console.log('🧹 Cleaning up WebSocket connection')
      clearInterval(heartbeatInterval)
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId)
      }
      newSocket.close()
      setSocket(null)
      setIsConnected(false)
      setConnectionQuality('disconnected')
    }
  }, [enabled, storeId, initializeWebSocket])

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
    connectionQuality,
    reconnectAttempts,
    broadcastInventoryUpdate,
    broadcastCartUpdate
  }
}
