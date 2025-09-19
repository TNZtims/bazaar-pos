import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'

// GET /api/reports/daily - Daily sales report
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const date = searchParams.get('date')
    const targetDate = date ? new Date(date) : new Date()
    
    const startOfDay = new Date(targetDate)
    startOfDay.setHours(0, 0, 0, 0)
    
    const endOfDay = new Date(targetDate)
    endOfDay.setHours(23, 59, 59, 999)
    
    const sales = await Sale.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    })
    
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
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error generating daily report', error: error.message },
      { status: 500 }
    )
  }
}
