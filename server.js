const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || (dev ? 'localhost' : '0.0.0.0')
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NODE_ENV === 'production' 
        ? process.env.ALLOWED_ORIGINS?.split(',') || false
        : "*",
      methods: ["GET", "POST"],
      credentials: true
    },
    maxHttpBufferSize: 1e6, // 1MB
    pingTimeout: 60000,
    pingInterval: 25000
  })

  // Make io globally available for API routes
  global.io = io

  // Store connections by store ID for targeted broadcasts
  const storeConnections = new Map()

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)

    // Join store-specific room
    socket.on('join-store', (storeId) => {
      const roomName = `store-${storeId}`
      socket.join(roomName)
      
      if (!storeConnections.has(storeId)) {
        storeConnections.set(storeId, new Set())
      }
      storeConnections.get(storeId).add(socket.id)
      
      console.log(`Socket ${socket.id} joined store ${storeId}`)
    })

    // Handle inventory updates
    socket.on('inventory-update', (data) => {
      const { storeId, productId, updates } = data
      
      // Broadcast to all clients in the same store
      socket.to(`store-${storeId}`).emit('inventory-changed', {
        productId,
        ...updates,
        timestamp: new Date().toISOString()
      })
    })

    // Handle cart updates (for real-time stock reservation)
    socket.on('cart-update', (data) => {
      const { storeId, productId, action, quantity } = data
      
      // Broadcast cart changes to other clients
      socket.to(`store-${storeId}`).emit('cart-changed', {
        productId,
        action, // 'reserve' or 'release'
        quantity,
        timestamp: new Date().toISOString()
      })
    })

    // Handle order updates
    socket.on('order-update', (data) => {
      const { storeId, orderId, status, items } = data
      
      // Broadcast order status changes
      socket.to(`store-${storeId}`).emit('order-changed', {
        orderId,
        status,
        items,
        timestamp: new Date().toISOString()
      })
    })

    // Handle store status updates
    socket.on('store-status-update', (data) => {
      const { storeId, isOnline, isActive } = data
      
      // Broadcast store status changes to all clients in the store
      socket.to(`store-${storeId}`).emit('store-status-changed', {
        isOnline,
        isActive,
        timestamp: new Date().toISOString()
      })
    })

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
      
      // Clean up store connections
      storeConnections.forEach((connections, storeId) => {
        connections.delete(socket.id)
        if (connections.size === 0) {
          storeConnections.delete(storeId)
        }
      })
    })
  })

  // Make io instance available globally for API routes
  global.io = io
  
  // Log when store status changes are emitted
  io.on('store-status-changed', (data) => {
    console.log('🏪 Server: Store status changed event received:', data)
  })

  httpServer
    .once('error', (err) => {
      console.error(err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Environment: ${process.env.NODE_ENV || 'development'}`)
      console.log(`> CORS Origins: ${process.env.NODE_ENV === 'production' ? process.env.ALLOWED_ORIGINS || 'none' : '*'}`)
    })
})
