import jwt from 'jsonwebtoken'
import { NextRequest } from 'next/server'
import Store, { IStore } from '@/models/Store'
import User, { IUser } from '@/models/User'
import connectToDatabase from '@/lib/mongodb'

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// Admin/Store auth payload
export interface AuthPayload {
  storeId: string
  storeName: string
  username?: string
  isAdmin: boolean
  selectedCashier?: string
}

// Customer auth payload
export interface CustomerAuthPayload {
  userId: string
  userCustomId: string
  userName: string
  storeId: string
  storeName: string
  isCustomer: boolean
  isAdmin: false
}

// Combined payload type
export type TokenPayload = AuthPayload | CustomerAuthPayload

export interface AuthContext {
  store: IStore
  selectedCashier?: string
}

export interface CustomerAuthContext {
  user: IUser
  store: IStore
}

// Generate JWT token
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

// Verify JWT token
export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}

// Extract token from request (admin/store tokens)
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

// Extract customer token from request
export function extractCustomerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }
  
  // Check customer auth cookie
  const customerTokenCookie = request.cookies.get('customer-auth-token')
  if (customerTokenCookie) {
    return customerTokenCookie.value
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
    
    // Check if it's a customer token (shouldn't be used for admin endpoints)
    if ('isCustomer' in payload) {
      return null
    }

    await connectToDatabase()

    const store = await Store.findById(payload.storeId).lean()
    if (!store || !store.isActive) {
      return null
    }

    return { 
      store: store as IStore,
      selectedCashier: payload.selectedCashier 
    }
  } catch (error) {
    console.error('Authentication error:', error)
    return null
  }
}

// Authenticate customer request
export async function authenticateCustomerRequest(request: NextRequest): Promise<CustomerAuthContext | null> {
  try {
    const token = extractCustomerToken(request)
    if (!token) {
      return null
    }

    const payload = verifyToken(token)
    
    // Check if it's a customer token
    if (!('isCustomer' in payload) || !payload.isCustomer) {
      return null
    }

    await connectToDatabase()

    const user = await User.findById(payload.userId).lean()
    if (!user || !user.isActive) {
      return null
    }

    const store = await Store.findById(payload.storeId).lean()
    if (!store || !store.isActive) {
      return null
    }

    return { 
      user: user as IUser, 
      store: store as IStore 
    }
  } catch (error) {
    console.error('Customer authentication error:', error)
    return null
  }
}

// Check if store can access data (always true since each store only sees their own data)
export function canAccessStore(store: IStore, storeId: string): boolean {
  return String(store._id) === storeId
}

// Authenticate request with admin requirement
export async function authenticateAdminRequest(request: NextRequest): Promise<AuthContext | null> {
  const authContext = await authenticateRequest(request)
  
  if (!authContext || !authContext.store.isAdmin) {
    return null
  }
  
  return authContext
}

// Check if store has admin privileges
export function isAdmin(store: IStore): boolean {
  return store.isAdmin === true
}
