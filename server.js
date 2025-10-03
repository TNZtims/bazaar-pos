const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = process.env.PORT || 3000

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      // Add Socket.IO health check endpoint
      if (req.url === '/socket.io-health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          status: 'ok', 
          socketio: 'running',
          timestamp: new Date().toISOString()
        }))
        return
      }
      
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  // Initialize Socket.IO with more permissive settings for production
  const io = new Server(httpServer, {
    cors: {
      origin: dev ? "*" : ["https://bzpos.outdoorequippedservice.com", "https://www.bzpos.outdoorequippedservice.com"],
      methods: ["GET", "POST", "OPTIONS"],
      credentials: true,
      allowedHeaders: ["*"]
    },
    transports: ['polling', 'websocket'],
    allowEIO3: true,
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000,
    upgradeTimeout: 10000
  })

  // Add debugging for Socket.IO server
  console.log('🔌 Socket.IO server initialized with config:', {
    cors: io.engine.opts.cors,
    transports: io.engine.opts.transports,
    pingTimeout: io.engine.opts.pingTimeout,
    pingInterval: io.engine.opts.pingInterval
  })

  // Make io globally available for API routes
  global.io = io

  // Store connections by store ID for targeted broadcasts
  const storeConnections = new Map()
  // Store user info by socket ID
  const userInfo = new Map()

  // Function to broadcast online users info to a store
  const broadcastOnlineUsers = (storeId) => {
    const connections = storeConnections.get(storeId)
    if (!connections) return
    
    const users = Array.from(connections).map(socketId => {
      const info = userInfo.get(socketId)
      return info ? {
        socketId,
        name: info.name,
        avatar: info.avatar
      } : {
        socketId,
        name: 'Anonymous',
        avatar: null
      }
    })
    
    io.to(`store-${storeId}`).emit('online-users-update', {
      type: 'online-users-update',
      count: users.length,
      users: users
    })
    
    console.log(`📊 Store ${storeId}: ${users.length} users online`, users.map(u => u.name))
  }

  // Add connection debugging
  io.engine.on('connection_error', (err) => {
    console.error('🔌 Socket.IO engine connection error:', err)
  })

  io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id, 'from:', socket.handshake.address)
    console.log('🔌 Handshake details:', {
      headers: socket.handshake.headers,
      query: socket.handshake.query,
      origin: socket.handshake.headers.origin
    })
    
    // Handle connection errors
    socket.on('error', (error) => {
      console.error('🔌 Socket error:', error)
    })

    // Join store-specific room
    socket.on('join-store', (data) => {
      const { storeId, userName, userAvatar } = data
      const roomName = `store-${storeId}`
      socket.join(roomName)
      
      if (!storeConnections.has(storeId)) {
        storeConnections.set(storeId, new Set())
      }
      storeConnections.get(storeId).add(socket.id)
      
      // Store user info
      userInfo.set(socket.id, {
        name: userName || 'Anonymous',
        avatar: userAvatar || null,
        storeId: storeId
      })
      
      console.log(`Socket ${socket.id} joined store ${storeId} as ${userName || 'Anonymous'}`)
      
      // Broadcast updated online users info
      broadcastOnlineUsers(storeId)
    })

    // Handle online users info request
    socket.on('get-online-users', (data) => {
      const { storeId } = data
      if (storeId) {
        const connections = storeConnections.get(storeId)
        if (!connections) {
          socket.emit('online-users-update', {
            type: 'online-users-update',
            count: 0,
            users: []
          })
          return
        }
        
        const users = Array.from(connections).map(socketId => {
          const info = userInfo.get(socketId)
          return info ? {
            socketId,
            name: info.name,
            avatar: info.avatar
          } : {
            socketId,
            name: 'Anonymous',
            avatar: null
          }
        })
        
        socket.emit('online-users-update', {
          type: 'online-users-update',
          count: users.length,
          users: users
        })
      }
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
      
      // Get user info before cleanup
      const user = userInfo.get(socket.id)
      const storeId = user?.storeId
      
      // Clean up user info
      userInfo.delete(socket.id)
      
      // Clean up store connections and broadcast updated info
      if (storeId) {
        const connections = storeConnections.get(storeId)
        if (connections && connections.has(socket.id)) {
          connections.delete(socket.id)
          
          // Broadcast updated online users info
          broadcastOnlineUsers(storeId)
          
          if (connections.size === 0) {
            storeConnections.delete(storeId)
          }
        }
      }
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
      console.log(`> Environment: ${dev ? 'development' : 'production'}`)
      console.log(`> Socket.IO server initialized with CORS origin: ${dev ? '*' : 'https://bzpos.outdoorequippedservice.com'}`)
    })
})
