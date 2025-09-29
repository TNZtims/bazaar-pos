import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { authenticateAdminRequest } from '@/lib/auth'

// GET /api/admin/stores - Get all stores (admin only)
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateAdminRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }
    
    await connectToDatabase()
    
    const stores = await Store.find({})
      .select('storeName isActive isAdmin cashiers isOnline isLocked storeHours bannerImageUrl logoImageUrl qrCodes createdAt updatedAt')
      .sort({ createdAt: -1 })
    
    // Ensure isLocked field exists for all stores (set to false if undefined)
    const normalizedStores = stores.map(store => ({
      ...store.toObject(),
      isLocked: store.isLocked || false
    }))
    
    return NextResponse.json({
      stores: normalizedStores,
      total: normalizedStores.length
    })
  } catch (error: any) {
    console.error('Error fetching stores:', error)
    return NextResponse.json(
      { message: 'Error fetching stores', error: error.message },
      { status: 500 }
    )
  }
}
