import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import bcrypt from 'bcryptjs'

// POST /api/stores/setup - Create new store (public route for initial setup)
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { 
      storeName, 
      username, 
      password,
      address,
      phone,
      email,
      description
    } = body
    
    // Validation
    if (!storeName || !username || !password) {
      return NextResponse.json(
        { message: 'Store name, username, and password are required' },
        { status: 400 }
      )
    }
    
    if (password.length < 6) {
      return NextResponse.json(
        { message: 'Password must be at least 6 characters' },
        { status: 400 }
      )
    }
    
    // Check if username already exists
    const existingStore = await Store.findOne({ username })
    if (existingStore) {
      return NextResponse.json(
        { message: 'Username already exists' },
        { status: 400 }
      )
    }
    
    // Hash password manually
    const salt = await bcrypt.genSalt(12)
    const hashedPassword = await bcrypt.hash(password, salt)
    
    // Create store
    const store = new Store({
      name: storeName,
      address,
      phone,
      email,
      description,
      username,
      password: hashedPassword,
      settings: {
        currency: 'PHP',
        taxRate: 0,
        timezone: 'Asia/Manila',
        businessHours: {
          open: '09:00',
          close: '18:00',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
        }
      },
      subscription: {
        plan: 'basic',
        status: 'active'
      }
    })
    
    const savedStore = await store.save()
    
    return NextResponse.json({
      message: 'Store created successfully',
      store: {
        id: savedStore._id,
        name: savedStore.name,
        username: username // Use the original username instead of from savedStore
      }
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating store:', error)
    
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'Username already exists' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { message: 'Error creating store', error: error.message },
      { status: 500 }
    )
  }
}
