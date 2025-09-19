import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import Store, { IStore } from '@/models/Store'
import connectToDatabase from '@/lib/mongodb'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

export interface AuthPayload {
  storeId: string
  storeName: string
  username: string
}

export interface AuthContext {
  store: IStore
}

// Generate JWT token
export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

// Verify JWT token
export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, JWT_SECRET) as AuthPayload
}

// Extract token from request
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // Also check cookies for browser requests
  const tokenCookie = request.cookies.get('auth-token')
  if (tokenCookie) {
    return tokenCookie.value
  }
  
  return null
}

// Authenticate request and return store context
export async function authenticateRequest(request: NextRequest): Promise<AuthContext | null> {
  try {
    const token = extractToken(request)
    if (!token) {
      return null
    }

    const payload = verifyToken(token)
    await connectToDatabase()

    const store = await Store.findById(payload.storeId).lean()
    if (!store || !store.isActive) {
      return null
    }

    // Check subscription status
    if (store.subscription.status !== 'active') {
      return null
    }

    return { store: store as IStore }
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

// Check if store can access data (always true since each store only sees their own data)
export function canAccessStore(store: IStore, storeId: string): boolean {
  return (store._id as any).toString() === storeId
}
