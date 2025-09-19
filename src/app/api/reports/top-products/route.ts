import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'

// GET /api/reports/top-products - Top selling products
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const matchStage: any = {}
    
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
    
    return NextResponse.json(topProducts)
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error generating top products report', error: error.message },
      { status: 500 }
    )
  }
}
