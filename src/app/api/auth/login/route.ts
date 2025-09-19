import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { username, password } = await request.json()
    
    // Validation
    if (!username || !password) {
      return NextResponse.json(
        { message: 'Username and password are required' },
        { status: 400 }
      )
    }
    
    // Find store by username
    const store = await Store.findOne({ username })
    
    if (!store || !store.isActive) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    // Check password
    const isPasswordValid = await store.comparePassword(password)
    
    if (!isPasswordValid) {
      return NextResponse.json(
        { message: 'Invalid credentials' },
        { status: 401 }
      )
    }
    
    // Check subscription status
    if (store.subscription.status !== 'active') {
      return NextResponse.json(
        { message: 'Store subscription is not active' },
        { status: 403 }
      )
    }
    
    // Generate token
    const token = generateToken({
      storeId: String(store._id),
      storeName: store.name,
      username: store.username
    })
    
    // Create response
    const response = NextResponse.json({
      message: 'Login successful',
      store: {
        id: store._id,
        name: store.name,
        username: store.username,
        settings: store.settings
      }
    })
    
    // Set cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })
    
    return response
  } catch (error: unknown) {
    console.error('Login error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
