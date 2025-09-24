import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { checkStoreStatus } from '@/lib/storeStatus'

// GET /api/stores/public/[id] - Get public store info (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()

    const { id } = await params
    
    // Validate store ID
    if (!id || id === 'null' || id === 'undefined') {
      return NextResponse.json(
        { message: 'Invalid store ID' },
        { status: 400 }
      )
    }

    const store = await Store.findOne({ 
      _id: id, 
      isActive: true 
    }).select('storeName _id isOnline storeHours isActive')

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    // Check store status (hours, online status)
    const storeStatus = checkStoreStatus(store)

    return NextResponse.json({
      id: store._id,
      name: store.storeName,
      status: storeStatus
    })
  } catch (error: any) {
    console.error('Error fetching store:', error)
    return NextResponse.json(
      { message: 'Error fetching store', error: error.message },
      { status: 500 }
    )
  }
}
