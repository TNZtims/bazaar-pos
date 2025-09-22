import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import Store from '@/models/Store'
import { generateToken } from '@/lib/auth'

// POST /api/auth/customer - Customer login with ID only
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { userId, storeId } = await request.json()
    
    // Validation
    if (!userId || !storeId) {
      return NextResponse.json(
        { message: 'User ID and Store ID are required' },
        { status: 400 }
      )
    }

    // Find store first
    const store = await Store.findById(storeId)
    if (!store || !store.isActive) {
      return NextResponse.json(
        { message: 'Store not found or inactive' },
        { status: 404 }
      )
    }

    // Find user by custom ID and store
    const user = await User.findOne({ 
      customId: userId.trim(), 
      storeId: store._id,
      isActive: true 
    })
    
    if (!user) {
      return NextResponse.json(
        { message: 'Invalid user ID or user not found' },
        { status: 401 }
      )
    }
    // Generate customer token (different from admin token)
    const token = generateToken({
      userId: String(user._id),
      userCustomId: user.customId,
      userName: user.name,
      storeId: String(store._id),
      storeName: store.storeName,
      isCustomer: true,
      isAdmin: false
    })

    // Create response
    const response = NextResponse.json({
      message: 'Customer login successful',
      user: {
        id: user._id,
        customId: user.customId,
        name: user.name
      },
      store: {
        id: store._id,
        name: store.storeName
      }
    })

    // Set cookie
    response.cookies.set('customer-auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 hours
    })

    return response
  } catch (error: unknown) {
    console.error('Customer login error:', error)
    return NextResponse.json(
      { message: 'Login failed', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
