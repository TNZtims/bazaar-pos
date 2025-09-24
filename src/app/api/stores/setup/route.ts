import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import bcrypt from 'bcryptjs'
import { authenticateAdminRequest } from '@/lib/auth'

// POST /api/stores/setup - Create new store (admin only)
export async function POST(request: NextRequest) {
  try {
    // Check if user is authenticated and has admin privileges
    const authContext = await authenticateAdminRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin access required to create stores' },
        { status: 403 }
      )
    }
    
    await connectToDatabase()
    
    const body = await request.json()
    const { 
      storeName, 
      password,
      isAdmin = false,
      cashiers = []
    } = body
    
    // Validation
    if (!storeName || !password) {
      return NextResponse.json(
        { message: 'Store name and password are required' },
        { status: 400 }
      )
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }
    
    // Check if store name already exists
    const existingStore = await Store.findOne({ storeName })
    if (existingStore) {
      return NextResponse.json(
        { message: 'Store name already exists' },
        { status: 400 }
      )
    }
    
    // Hash password manually
    const salt = await bcrypt.genSalt(12)
    const hashedPassword = await bcrypt.hash(password, salt)
    
    // Create store with default values for new fields
    const store = new Store({
      storeName,
      password: hashedPassword,
      isAdmin,
      isActive: true,
      cashiers: Array.isArray(cashiers) ? cashiers : [],
      isOnline: true // Default to online
    })
    
    const savedStore = await store.save()
    
    return NextResponse.json({
      message: 'Store created successfully',
      store: {
        id: savedStore._id,
        storeName: savedStore.storeName,
        isAdmin: savedStore.isAdmin,
        cashiers: savedStore.cashiers
      }
    }, { status: 201 })
  } catch (error: unknown) {
    console.error('Error creating store:', error)
    
    if (error && typeof error === 'object' && 'code' in error && (error as any).code === 11000) {
      return NextResponse.json(
        { message: 'Store name already exists' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { message: 'Error creating store', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
