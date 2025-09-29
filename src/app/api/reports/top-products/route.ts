import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import { authenticateRequest } from '@/lib/auth'

// GET /api/reports/top-products - Top selling products
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
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const matchStage: Record<string, unknown> = {
      storeId: authContext.store._id  // Filter by store ID
    }
    
    if (startDate || endDate) {
      matchStage.createdAt = {}
      if (startDate) matchStage.createdAt.$gte = new Date(startDate)
      if (endDate) matchStage.createdAt.$lte = new Date(endDate)
    }
    
    const topProducts = await Sale.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          salesCount: { $sum: 1 }
        }
      },
      { $sort: { totalQuantitySold: -1 } },
      { $limit: limit }
    ])
    
    console.log(`📈 Top Products Report: Found ${topProducts.length} top products for store ${authContext.store.storeName}`)
    
    return NextResponse.json(topProducts)
  } catch (error: unknown) {
    return NextResponse.json(
      { message: 'Error generating top products report', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
