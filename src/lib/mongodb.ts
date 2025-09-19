import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/pos_db'

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
}

// Global is used here to maintain a cached connection across hot reloads in development
let cached = (global as any).mongoose

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null }
}

async function connectToDatabase() {
  if (cached.conn) {
    return cached.conn
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10, // Maintain up to 10 socket connections
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
      dbName: 'pos_db' // Explicitly set database name
    }

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      console.log('✅ Connected to MongoDB')
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
  } catch (e) {
    cached.promise = null
    console.error('❌ MongoDB connection error:', e)
    throw e
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