import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import Product from '@/models/Product'

// GET /api/reports/profit - Get profit analytics
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const period = searchParams.get('period') || '30' // days
    
    let dateFilter: any = {}
    
    if (startDate && endDate) {
      dateFilter = {
        createdAt: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      }
    } else {
      // Default to last N days
      const daysAgo = new Date()
      daysAgo.setDate(daysAgo.getDate() - parseInt(period))
      dateFilter = {
        createdAt: { $gte: daysAgo }
      }
    }
    
    // Get sales with populated product data
    const sales = await Sale.find({
      ...dateFilter,
      status: { $in: ['completed', 'active'] }
    }).populate('items.product', 'cost name')
    
    let totalRevenue = 0
    let totalCost = 0
    let totalProfit = 0
    const productProfits: { [key: string]: { 
      name: string, 
      revenue: number, 
      cost: number, 
      profit: number, 
      quantity: number,
      profitMargin: number
    }} = {}
    
    // Calculate profits
    for (const sale of sales) {
      totalRevenue += sale.finalAmount
      
      for (const item of sale.items) {
        const product = item.product as any
        const itemRevenue = item.totalPrice
        const itemCost = (product?.cost || 0) * item.quantity
        const itemProfit = itemRevenue - itemCost
        
        totalCost += itemCost
        totalProfit += itemProfit
        
        // Track per-product profits
        const productId = product?._id?.toString() || item.product.toString()
        if (!productProfits[productId]) {
          productProfits[productId] = {
            name: item.productName,
            revenue: 0,
            cost: 0,
            profit: 0,
            quantity: 0,
            profitMargin: 0
          }
        }
        
        productProfits[productId].revenue += itemRevenue
        productProfits[productId].cost += itemCost
        productProfits[productId].profit += itemProfit
        productProfits[productId].quantity += item.quantity
      }
    }
    
    // Calculate profit margins
    const overallProfitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0
    
    // Sort products by profit and add profit margins
    const topProfitableProducts = Object.values(productProfits)
      .map(p => ({
        ...p,
        profitMargin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10)
    
    const lowProfitProducts = Object.values(productProfits)
      .map(p => ({
        ...p,
        profitMargin: p.revenue > 0 ? (p.profit / p.revenue) * 100 : 0
      }))
      .sort((a, b) => a.profitMargin - b.profitMargin)
      .slice(0, 5)
    
    return NextResponse.json({
      summary: {
        totalRevenue,
        totalCost,
        totalProfit,
        profitMargin: overallProfitMargin,
        salesCount: sales.length
      },
      topProfitableProducts,
      lowProfitProducts,
      period: {
        startDate: startDate || new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000).toISOString(),
        endDate: endDate || new Date().toISOString(),
        days: parseInt(period)
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error fetching profit analytics', error: error.message },
      { status: 500 }
    )
  }
}
