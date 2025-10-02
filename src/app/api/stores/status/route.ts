import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import { authenticateRequest } from '@/lib/auth'
import Store from '@/models/Store'

// GET /api/stores/status - Get store status and hours
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    const store = await Store.findById(authContext.store._id)
      .select('storeName isOnline isActive isLocked')

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      storeName: store.storeName,
      isOnline: store.isOnline,
      isActive: store.isActive,
      isLocked: store.isLocked
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error fetching store status', error: error.message },
      { status: 500 }
    )
  }
}

// PATCH /api/stores/status - Update store status and hours
export async function PATCH(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    await connectToDatabase()
    
    const body = await request.json()
    const { isOnline } = body

    const updateData: any = {}
    
    if (isOnline !== undefined) {
      updateData.isOnline = isOnline
    }

    const store = await Store.findByIdAndUpdate(
      authContext.store._id,
      updateData,
      { new: true, runValidators: true }
    ).select('storeName isOnline isActive isLocked')

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    // Emit WebSocket event for store status change
    if (global.io) {
      console.log(`🏪 API: Emitting store status change for store ${store._id}:`, { isOnline: store.isOnline, isActive: store.isActive, isLocked: store.isLocked })
      console.log(`🏪 API: Available rooms:`, Array.from(global.io.sockets.adapter.rooms.keys()))
      
      const roomName = `store-${store._id}`
      const room = global.io.sockets.adapter.rooms.get(roomName)
      console.log(`🏪 API: Clients in room ${roomName}:`, room ? room.size : 0)
      
      global.io.to(roomName).emit('store-status-changed', {
        isOnline: store.isOnline,
        isActive: store.isActive,
        isLocked: store.isLocked,
        timestamp: new Date().toISOString()
      })
      
      console.log(`🏪 API: Store status event emitted to room ${roomName}`)
    } else {
      console.log('🏪 API: Global.io not available for WebSocket emission')
    }

    return NextResponse.json({
      storeName: store.storeName,
      isOnline: store.isOnline,
      isActive: store.isActive,
      isLocked: store.isLocked
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error updating store status', error: error.message },
      { status: 500 }
    )
  }
}
