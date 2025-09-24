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
      .select('storeName isOnline isActive')

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      storeName: store.storeName,
      isOnline: store.isOnline,
      isActive: store.isActive
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
    ).select('storeName isOnline isActive')

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      storeName: store.storeName,
      isOnline: store.isOnline,
      isActive: store.isActive
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error updating store status', error: error.message },
      { status: 500 }
    )
  }
}
