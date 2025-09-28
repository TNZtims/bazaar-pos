import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'

// GET /api/stores/cashiers/public - Get cashiers list by store name (public endpoint for login)
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const storeName = searchParams.get('storeName')
    
    if (!storeName) {
      return NextResponse.json(
        { message: 'Store name is required' },
        { status: 400 }
      )
    }

    // Find store by store name
    const store = await Store.findOne({ 
      storeName: storeName.trim(),
      isActive: true 
    })
    
    if (!store) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      cashiers: store.cashiers || []
    })

  } catch (error: any) {
    console.error('Error fetching cashiers:', error)
    return NextResponse.json(
      { message: 'Error fetching cashiers', error: error.message },
      { status: 500 }
    )
  }
}
