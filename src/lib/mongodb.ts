import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_db'

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

// Global is used here to maintain a cached connection across hot reloads in development
let cached = (global as { mongoose?: { conn: typeof mongoose | null, promise: Promise<typeof mongoose> | null } }).mongoose

if (!cached) {
  cached = (global as { mongoose?: { conn: typeof mongoose | null, promise: Promise<typeof mongoose> | null } }).mongoose = { conn: null, promise: null }
}

async function connectToDatabase() {
  // Return existing connection if available and ready
  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 3000, // Reduced timeout for faster failure
      socketTimeoutMS: 20000, // Reduced socket timeout
      connectTimeoutMS: 10000, // Connection timeout
      heartbeatFrequencyMS: 10000, // Heartbeat frequency
      retryWrites: true,
      retryReads: true,
      maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
      dbName: 'pos_db' // Explicitly set database name
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ Connected to MongoDB')
      return mongoose
    }).catch((error) => {
      console.error('❌ MongoDB connection failed:', error.message)
      cached.promise = null
      throw error
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    console.error('❌ MongoDB connection error:', e.message)
    throw new Error(`Database connection failed: ${e.message}`)
  }

  return cached.conn
}

// Graceful shutdown
process.on('SIGINT', async () => {
  if (cached.conn) {
    await cached.conn.connection.close()
    console.log('📴 MongoDB connection closed due to app termination')
    process.exit(0)
  }
})

export default connectToDatabase