import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { generateToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { storeName, password, selectedCashier } = await request.json()
    
    // Validation
    if (!storeName || !password) {
      return NextResponse.json(
        { message: 'Store name and password are required' },
        { status: 400 }
      )
    }

    if (selectedCashier && typeof selectedCashier !== 'string') {
      return NextResponse.json(
        { message: 'Invalid cashier selection' },
        { status: 400 }
      )
    }
    
    // Find store by store name
    const store = await Store.findOne({ storeName })
    
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

    // Validate cashier if provided
    if (selectedCashier && !store.cashiers?.includes(selectedCashier)) {
      return NextResponse.json(
        { message: 'Invalid cashier selection' },
        { status: 400 }
      )
    }
    
    // Generate token
    const token = generateToken({
      storeId: String(store._id),
      storeName: store.storeName,
      isAdmin: store.isAdmin,
      selectedCashier: selectedCashier
    })
    
    // Create response
    const response = NextResponse.json({
      message: 'Login successful',
      store: {
        id: store._id,
        storeName: store.storeName,
        isAdmin: store.isAdmin,
        cashiers: store.cashiers,
        selectedCashier: selectedCashier
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
