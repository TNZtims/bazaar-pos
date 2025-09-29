import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { checkStoreStatus } from '@/lib/storeStatus'

// GET /api/stores/resolve/[storeName] - Resolve store name to store data
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ storeName: string }> }
) {
  try {
    await connectToDatabase()

    const { storeName } = await params
    
    if (!storeName) {
      return NextResponse.json(
        { message: 'Store name is required' },
        { status: 400 }
      )
    }

    // Decode URL-encoded store name and normalize it
    const decodedStoreName = decodeURIComponent(storeName)
    
    // Find the actual requested store for store-specific content (products, banner, logo, name)
    const store = await Store.findOne({ 
      storeName: { $regex: new RegExp(`^${decodedStoreName}$`, 'i') },
      isActive: true 
    }).select('_id storeName isOnline storeHours isActive isLocked bannerImageUrl logoImageUrl qrCodes')

    if (!store) {
      return NextResponse.json(
        { message: 'Store not found or inactive' },
        { status: 404 }
      )
    }

    // Log store resolution for verification
    console.log(`🏪 Store resolution: ${decodedStoreName} → Using actual store ${store.storeName} (ID: ${store._id})`)

    // Check store status (hours, online status)
    const storeStatus = checkStoreStatus(store)

    // Always return 200 OK, but include store accessibility in the response
    return NextResponse.json({
      id: store._id,
      name: store.storeName,
      status: storeStatus,
      isLocked: store.isLocked,
      accessible: !store.isLocked, // true if store is open to public, false if closed
      message: store.isLocked ? 'Store is currently closed to public access' : 'Store is open',
      bannerImageUrl: store.bannerImageUrl,
      logoImageUrl: store.logoImageUrl,
      qrCodes: store.qrCodes
    })
  } catch (error: any) {
    console.error('Error resolving store name:', error)
    return NextResponse.json(
      { message: 'Error resolving store', error: error.message },
      { status: 500 }
    )
  }
}
