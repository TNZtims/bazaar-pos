import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import { authenticateRequest } from '@/lib/auth'

// GET /api/reports/daily - Daily sales report
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
    const date = searchParams.get('date')
    const targetDate = date ? new Date(date) : new Date()
    
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)
    
    // Filter sales by store ID and date range
    const sales = await Sale.find({
      storeId: authContext.store._id,
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
    
    console.log(`📊 Daily Report: Found ${sales.length} sales for store ${authContext.store.storeName} on ${targetDate.toISOString().split('T')[0]}`)
    
    const totalSales = sales.length
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.finalAmount, 0)
    const averageOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0
    
    return NextResponse.json({
      date: targetDate.toISOString().split('T')[0],
      totalSales,
      totalRevenue,
      averageOrderValue,
      sales
    })
  } catch (error: unknown) {
    return NextResponse.json(
      { message: 'Error generating daily report', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
