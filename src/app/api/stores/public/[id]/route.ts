import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'

// GET /api/stores/public/[id] - Get public store info (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()

    const { id } = await params
    const store = await Store.findOne({ 
      _id: id, 
      isActive: true 
    }).select('storeName _id').lean()

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: store._id,
      name: store.storeName
    })
  } catch (error: any) {
    console.error('Error fetching store:', error)
    return NextResponse.json(
      { message: 'Error fetching store', error: error.message },
      { status: 500 }
    )
  }
}
