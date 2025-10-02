import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// GET /api/reports/sales-source - Get sales breakdown by source (reservations vs walk-in)
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const sellers = searchParams.get('sellers')
    const paymentStatus = searchParams.get('paymentStatus')
    const productId = searchParams.get('productId')
    
    console.log('🔍 Sales Source API Filters:', { startDate, endDate, sellers, paymentStatus, productId })
    
    // Build base query
    const query: any = { 
      storeId: authContext.store._id,
      status: 'completed' // Only count completed sales
    }
    
    // Apply date range filter
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }
    
    // Apply payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus
    } else {
      query.paymentStatus = 'paid' // Default to paid sales only
    }
    
    // Apply product filter
    if (productId && productId !== 'all') {
      query['items.product'] = new mongoose.Types.ObjectId(productId)
    }
    
    // Handle seller filter - need to get products first if seller filter is applied
    let productIds: mongoose.Types.ObjectId[] | undefined
    if (sellers) {
      const sellerArray = sellers.split(',').map(s => s.trim()).filter(s => s.length > 0)
      if (sellerArray.length > 0) {
        const products = await Product.find({
          storeId: authContext.store._id,
          seller: { $in: sellerArray }
        }).select('_id')
        
        productIds = products.map(p => p._id)
        
        // If no products found for the selected sellers, return empty data
        if (productIds.length === 0) {
          return NextResponse.json({
            sources: [],
            totals: {
              totalSales: 0,
              totalRevenue: 0,
              totalItems: 0,
              averageOrderValue: 0
            },
            dateRange: {
              startDate: startDate || null,
              endDate: endDate || null
            }
          })
        }
        
        // Add product filter to query
        if (query['items.product']) {
          // If product filter is already applied, intersect with seller products
          query['items.product'] = {
            $in: [query['items.product'], ...productIds]
          }
        } else {
          query['items.product'] = { $in: productIds }
        }
      }
    }
    
    console.log('🔍 Sales Source API: Query:', JSON.stringify(query, null, 2))
    
    // Aggregate sales by source
    const salesSourceData = await Sale.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            source: {
              $cond: [
                { $ifNull: ['$customerId', false] },
                'reservation',
                'walk-in'
              ]
            }
          },
          totalSales: { $sum: 1 },
          totalRevenue: { $sum: '$finalAmount' },
          totalItems: { $sum: { $sum: '$items.quantity' } },
          averageOrderValue: { $avg: '$finalAmount' }
        }
      },
      {
        $project: {
          _id: 0,
          source: '$_id.source',
          totalSales: 1,
          totalRevenue: 1,
          totalItems: 1,
          averageOrderValue: { $round: ['$averageOrderValue', 2] }
        }
      },
      { $sort: { source: 1 } }
    ])
    
    // Calculate totals
    const totalSales = salesSourceData.reduce((sum, item) => sum + item.totalSales, 0)
    const totalRevenue = salesSourceData.reduce((sum, item) => sum + item.totalRevenue, 0)
    const totalItems = salesSourceData.reduce((sum, item) => sum + item.totalItems, 0)
    
    // Add percentages
    const salesSourceDataWithPercentages = salesSourceData.map(item => ({
      ...item,
      salesPercentage: totalSales > 0 ? Math.round((item.totalSales / totalSales) * 100) : 0,
      revenuePercentage: totalRevenue > 0 ? Math.round((item.totalRevenue / totalRevenue) * 100) : 0,
      itemsPercentage: totalItems > 0 ? Math.round((item.totalItems / totalItems) * 100) : 0
    }))
    
    console.log(`🔍 Sales Source API: Found ${salesSourceData.length} source types, total sales: ${totalSales}`)
    
    return NextResponse.json({
      sources: salesSourceDataWithPercentages,
      totals: {
        totalSales,
        totalRevenue,
        totalItems,
        averageOrderValue: totalSales > 0 ? Math.round((totalRevenue / totalSales) * 100) / 100 : 0
      },
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null
      }
    })
  } catch (error: unknown) {
    console.error('❌ Sales Source API Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { message: 'Error fetching sales source data', error: errorMessage },
      { status: 500 }
    )
  }
}
