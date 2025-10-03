const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID
const hostname = dev ? 'localhost' : '0.0.0.0'
const port = process.env.PORT || 3000

console.log('🚂 Environment:', {
  dev,
  isRailway: !!isRailway,
  hostname,
  port,
  nodeEnv: process.env.NODE_ENV
})

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Create HTTP server without request handler first
  const httpServer = createServer()

  // Initialize Socket.IO FIRST - this is critical!
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST", "OPTIONS"],
      credentials: false
    },
    transports: ['polling'],
    allowEIO3: true,
    pingTimeout: 20000,
    pingInterval: 25000
  })

  console.log('🔌 Socket.IO server initialized')

  // Add Socket.IO debugging
  io.engine.on('connection_error', (err) => {
    console.error('🔌 Socket.IO connection error:', err.message, err.description)
  })

  // Add error handling to prevent uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('🚨 Uncaught Exception:', err.message)
    if (err.code === 'ERR_HTTP_HEADERS_SENT') {
      console.error('🚨 Headers already sent - ignoring duplicate response')
      return // Don't exit process for this error
    }
    console.error('🚨 Fatal error, exiting process')
    process.exit(1)
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason)
  })

  // NOW add the request handler for non-Socket.IO requests
  httpServer.on('request', async (req, res) => {
    try {
      // Skip Socket.IO requests - they should be handled by Socket.IO server
      if (req.url && req.url.startsWith('/socket.io/')) {
        console.log('🔌 Socket.IO request intercepted:', req.method, req.url)
        return // Let Socket.IO handle this request - don't send any response
      }
      
      // Debug non-Socket.IO requests
      console.log('📥 Non-Socket.IO Request:', req.method, req.url, req.headers.origin)
      
      // Add Socket.IO health check endpoint
      if (req.url === '/socket.io-health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ 
          status: 'ok', 
          socketio: 'running',
          timestamp: new Date().toISOString(),
          connectedClients: io.engine.clientsCount
        }))
        return
      }
      
      // Add Socket.IO test endpoint
      if (req.url === '/socket.io-test') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <html>
            <head><title>Socket.IO Test</title></head>
            <body>
              <h1>Socket.IO Test</h1>
              <p>Socket.IO server is running</p>
              <p>Connected clients: ${io.engine.clientsCount}</p>
              <script src="/socket.io/socket.io.js"></script>
              <script>
                const socket = io();
                socket.on('connect', () => {
                  document.body.innerHTML += '<p style="color: green;">✅ Connected to Socket.IO!</p>';
                });
                socket.on('connect_error', (err) => {
                  document.body.innerHTML += '<p style="color: red;">❌ Connection failed: ' + err.message + '</p>';
                });
              </script>
            </body>
          </html>
        `)
        return
      }
      
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      // Only send error response if headers haven't been sent
      if (!res.headersSent) {
        res.statusCode = 500
        res.end('internal server error')
      }
    }
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

  io.on('connection', (socket) => {
    console.log('🔌 New client connected:', socket.id)
    console.log('🔌 Client handshake:', {
      origin: socket.handshake.headers.origin,
      userAgent: socket.handshake.headers['user-agent']
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
      console.log(`> Railway: ${isRailway ? 'Yes' : 'No'}`)
      console.log(`> Socket.IO server running on port ${port}`)
      console.log(`> Socket.IO transports: ${io.engine.opts.transports.join(', ')}`)
      console.log(`> Socket.IO CORS origin: ${io.engine.opts.cors.origin}`)
      console.log(`> Test Socket.IO at: http://${hostname}:${port}/socket.io/`)
    })
})
