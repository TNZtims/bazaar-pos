import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { authenticateAdminRequest } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// PATCH /api/admin/stores/[id] - Update store status (admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await authenticateAdminRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }
    
    await connectToDatabase()
    
    const { id } = await params
    const body = await request.json()
    const { isActive } = body
    
    if (typeof isActive !== 'boolean') {
      return NextResponse.json(
        { message: 'isActive must be a boolean' },
        { status: 400 }
      )
    }
    
    const store = await Store.findByIdAndUpdate(
      id,
      { isActive },
      { new: true, runValidators: true }
    )
    
    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      message: `Store ${isActive ? 'activated' : 'deactivated'} successfully`,
      store: {
        id: store._id,
        storeName: store.storeName,
        isActive: store.isActive,
        isAdmin: store.isAdmin
      }
    })
  } catch (error: any) {
    console.error('Error updating store:', error)
    return NextResponse.json(
      { message: 'Error updating store', error: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/admin/stores/[id] - Update store details (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await authenticateAdminRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }
    
    await connectToDatabase()
    
    const { id } = await params
    const body = await request.json()
    const { storeName, password, isAdmin, cashiers, isOnline, storeHours } = body
    
    if (!storeName) {
      return NextResponse.json(
        { message: 'Store name is required' },
        { status: 400 }
      )
    }
    
    // Check if store exists
    const existingStore = await Store.findById(id)
    if (!existingStore) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }
    
    // Prepare update data
    const updateData: any = {
      storeName,
      isAdmin: Boolean(isAdmin),
      cashiers: Array.isArray(cashiers) ? cashiers : []
    }

    // Add optional fields if provided
    if (isOnline !== undefined) {
      updateData.isOnline = Boolean(isOnline)
    }

    if (storeHours && typeof storeHours === 'object') {
      updateData.storeHours = storeHours
    }
    
    // Handle password update if provided
    if (password && password.trim()) {
      if (password.length < 6) {
        return NextResponse.json(
          { message: 'Password must be at least 6 characters' },
          { status: 400 }
        )
      }
      
      const saltRounds = 10
      const hashedPassword = await bcrypt.hash(password, saltRounds)
      updateData.password = hashedPassword
    }
    
    // Check for duplicate store name (excluding current store)
    const duplicateStore = await Store.findOne({
      storeName,
      _id: { $ne: id }
    })
    
    if (duplicateStore) {
      return NextResponse.json(
        { message: 'Store name already exists' },
        { status: 400 }
      )
    }
    
    const updatedStore = await Store.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('storeName isActive isAdmin cashiers isOnline storeHours createdAt updatedAt')
    
    return NextResponse.json({
      message: 'Store updated successfully',
      store: updatedStore
    })
  } catch (error: any) {
    console.error('Error updating store details:', error)
    
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'Store name already exists' },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { message: 'Error updating store details', error: error.message },
      { status: 500 }
    )
  }
}
