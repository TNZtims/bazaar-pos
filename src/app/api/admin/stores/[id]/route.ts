import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { authenticateAdminRequest } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// Debug: Check if the Store model has the image fields
// console.log('Store schema paths:', Object.keys(Store.schema.paths))

// Force model refresh to ensure new fields are recognized
if (global.mongoose?.models?.Store) {
  delete global.mongoose.models.Store
  // console.log('Cleared cached Store model')
}

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
    const { isActive, isLocked } = body
    
    // Validate that at least one field is provided and is a boolean
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return NextResponse.json(
        { message: 'isActive must be a boolean' },
        { status: 400 }
      )
    }
    
    if (isLocked !== undefined && typeof isLocked !== 'boolean') {
      return NextResponse.json(
        { message: 'isLocked must be a boolean' },
        { status: 400 }
      )
    }
    
    if (isActive === undefined && isLocked === undefined) {
      return NextResponse.json(
        { message: 'Either isActive or isLocked must be provided' },
        { status: 400 }
      )
    }
    
    // Prepare update data
    const updateData: any = {}
    if (isActive !== undefined) updateData.isActive = isActive
    if (isLocked !== undefined) updateData.isLocked = isLocked
    
    const store = await Store.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('_id storeName isActive isLocked isAdmin isOnline')
    
    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }
    
    // Emit WebSocket event for store status change
    if (global.io) {
      console.log(`🏪 Admin API: Emitting store status change for store ${store._id}:`, { 
        isOnline: store.isOnline, 
        isActive: store.isActive,
        isLocked: store.isLocked 
      })
      
      const roomName = `store-${store._id}`
      const room = global.io.sockets.adapter.rooms.get(roomName)
      console.log(`🏪 Admin API: Clients in room ${roomName}:`, room ? room.size : 0)
      
      global.io.to(roomName).emit('store-status-changed', {
        isOnline: store.isOnline,
        isActive: store.isActive,
        isLocked: store.isLocked,
        timestamp: new Date().toISOString()
      })
      
      console.log(`🏪 Admin API: Store status event emitted to room ${roomName}`)
    } else {
      console.log('🏪 Admin API: Global.io not available for WebSocket emission')
    }
    
    // Generate appropriate success message
    let message = 'Store updated successfully'
    if (isActive !== undefined && isLocked === undefined) {
      message = `Store ${isActive ? 'activated' : 'deactivated'} successfully`
    } else if (isLocked !== undefined && isActive === undefined) {
      message = `Store ${isLocked ? 'locked (closed to public)' : 'unlocked (opened to public)'} successfully`
    }
    
    return NextResponse.json({
      message,
      store: {
        id: store._id,
        storeName: store.storeName,
        isActive: store.isActive,
        isLocked: store.isLocked,
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
    const { storeName, password, isAdmin, cashiers, isOnline, storeHours, bannerImageUrl, logoImageUrl, qrCodes } = body
    
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

    // Handle image URLs if provided
    if (bannerImageUrl !== undefined) {
      // Handle empty strings and null values properly
      updateData.bannerImageUrl = (bannerImageUrl && bannerImageUrl.trim() !== '') ? bannerImageUrl : null
      // console.log('Setting banner image URL:', bannerImageUrl, '-> processed:', updateData.bannerImageUrl) // Debug log
    }

    if (logoImageUrl !== undefined) {
      // Handle empty strings and null values properly  
      updateData.logoImageUrl = (logoImageUrl && logoImageUrl.trim() !== '') ? logoImageUrl : null
      // console.log('Setting logo image URL:', logoImageUrl, '-> processed:', updateData.logoImageUrl) // Debug log
    }

    // Handle QR codes if provided
    if (qrCodes && typeof qrCodes === 'object') {
      updateData.qrCodes = {
        gcash: (qrCodes.gcash && qrCodes.gcash.trim() !== '') ? qrCodes.gcash : null,
        gotyme: (qrCodes.gotyme && qrCodes.gotyme.trim() !== '') ? qrCodes.gotyme : null,
        bpi: (qrCodes.bpi && qrCodes.bpi.trim() !== '') ? qrCodes.bpi : null
      }
    }
    
    // console.log('Final updateData:', updateData) // Debug log
    
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
    
    // console.log('About to update store with ID:', id) // Debug log
    
    // Check what's in the database before update
    const beforeUpdate = await Store.findById(id)
    // console.log('Store before update:', beforeUpdate) // Debug log
    
    // Try a direct field update to test if the schema is working
    // console.log('Testing direct field update...')
    await Store.findByIdAndUpdate(id, {
      bannerImageUrl: updateData.bannerImageUrl,
      logoImageUrl: updateData.logoImageUrl
    })
    
    const updatedStore = await Store.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    )
    
    // console.log('Raw updated store (all fields):', updatedStore) // Debug log to see all fields
    
    if (!updatedStore) {
      console.error('Store update returned null - store not found')
      return NextResponse.json(
        { message: 'Store not found after update' },
        { status: 404 }
      )
    }
    
    // console.log('Updated store from database:', updatedStore) // Debug log
    // console.log('Updated store banner URL:', updatedStore?.bannerImageUrl) // Debug log
    // console.log('Updated store logo URL:', updatedStore?.logoImageUrl) // Debug log
    
    // Double-check by re-fetching the store
    const verificationStore = await Store.findById(id).select('bannerImageUrl logoImageUrl')
    // console.log('Verification fetch - banner URL:', verificationStore?.bannerImageUrl) // Debug log
    // console.log('Verification fetch - logo URL:', verificationStore?.logoImageUrl) // Debug log
    
    // Create a clean response object with all the fields we need
    const responseStore = {
      _id: updatedStore._id,
      storeName: updatedStore.storeName,
      isActive: updatedStore.isActive,
      isAdmin: updatedStore.isAdmin,
      cashiers: updatedStore.cashiers,
      isOnline: updatedStore.isOnline,
      isLocked: updatedStore.isLocked,
      storeHours: updatedStore.storeHours,
      bannerImageUrl: updatedStore.bannerImageUrl,
      logoImageUrl: updatedStore.logoImageUrl,
      qrCodes: updatedStore.qrCodes,
      createdAt: updatedStore.createdAt,
      updatedAt: updatedStore.updatedAt
    }
    
    // console.log('Response store object:', responseStore) // Debug log
    
    return NextResponse.json({
      message: 'Store updated successfully',
      store: responseStore
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
