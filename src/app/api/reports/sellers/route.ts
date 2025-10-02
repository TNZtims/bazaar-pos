import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// GET /api/reports/sellers - Get list of sellers from products
export async function GET(request: NextRequest) {
  try {
    // Authenticate request and get store context
    const authContext = await authenticateRequest(request)
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    await connectToDatabase()
    
    // Get unique sellers from products
    const sellers = await Product.aggregate([
      {
        $match: {
          storeId: authContext.store._id,
          seller: { $exists: true, $ne: null, $ne: '' }
        }
      },
      {
        $group: {
          _id: '$seller',
          productCount: { $sum: 1 },
          lastUpdated: { $max: '$updatedAt' }
        }
      },
      {
        $project: {
          name: '$_id',
          productCount: 1,
          lastUpdated: 1,
          _id: 0
        }
      },
      {
        $sort: { name: 1 }
      }
    ])
    
    console.log(`📊 Found ${sellers.length} sellers for store ${authContext.store.storeName}`)
    
    return NextResponse.json(sellers)
  } catch (error: unknown) {
    console.error('Error fetching sellers:', error)
    return NextResponse.json(
      { message: 'Error fetching sellers', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
