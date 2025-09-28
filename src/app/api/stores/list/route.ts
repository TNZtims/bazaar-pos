import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'

// GET /api/stores/list - Get all active stores for login dropdown
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    // Fetch all active stores, selecting only necessary fields
    const stores = await Store.find(
      { isActive: true }, // Only active stores
      { 
        _id: 1,
        storeName: 1,
        displayName: 1,
        cashiers: 1,
        isLocked: 1
      }
    ).sort({ storeName: 1 }) // Sort alphabetically
    
    // Transform the data for frontend consumption
    const storeList = stores.map(store => ({
      id: store._id.toString(),
      storeName: store.storeName,
      displayName: store.displayName || store.storeName,
      cashiers: store.cashiers || [],
      isLocked: store.isLocked || false
    }))
    
    const response = NextResponse.json({
      stores: storeList,
      total: storeList.length
    })
    
    // Add no-cache headers to ensure fresh store data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
    
  } catch (error: any) {
    console.error('Error fetching stores list:', error)
    return NextResponse.json(
      { 
        message: 'Error fetching stores', 
        error: error.message,
        stores: [],
        total: 0
      },
      { status: 500 }
    )
  }
}
