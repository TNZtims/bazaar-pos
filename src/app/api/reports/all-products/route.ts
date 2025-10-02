import { NextRequest, NextResponse } from 'next/server'
import mongoose from 'mongoose'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

interface ProductSalesData {
  _id: string
  productName: string
  currentStock: number
  price: number
  cost?: number
  category?: string
  seller?: string
  totalQuantitySold: number
  totalRevenue: number
  salesCount: number
  profit: number
  profitMargin: number
  lastSaleDate?: string
}

// GET /api/reports/all-products - All products with sales data
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const sellers = searchParams.get('sellers')
    const paymentStatus = searchParams.get('paymentStatus')
    const productId = searchParams.get('productId')
    
    console.log('🔍 API Request URL:', request.url)
    console.log('🔍 Search params:', Object.fromEntries(searchParams.entries()))
    console.log('🔍 Filters:', { startDate, endDate, sellers, paymentStatus, productId })
    
    // Build product filter query
    const productQuery: Record<string, unknown> = {
      storeId: authContext.store._id
    }
    
    // Apply sellers filter to products
    if (sellers) {
      const sellerArray = sellers.split(',').map(s => s.trim()).filter(s => s.length > 0)
      if (sellerArray.length > 0) {
        productQuery.seller = { $in: sellerArray }
      }
    }
    
    // Get all products for the store (filtered by seller if specified)
    const allProducts = await Product.find(productQuery).select('_id name price cost category quantity seller')
    
    // Get sales data with filters
    const matchStage: Record<string, unknown> = {
      storeId: authContext.store._id,
      status: 'completed'     // Only include completed sales
    }
    
    // Apply payment status filter (default to paid if not specified)
    if (paymentStatus && paymentStatus !== 'all') {
      matchStage.paymentStatus = paymentStatus
    } else if (!paymentStatus) {
      matchStage.paymentStatus = 'paid'  // Default to paid sales only
    }
    
    // Note: Sellers filter is applied to products query above
    
    // Apply product filter
    if (productId && productId !== 'all') {
      matchStage['items.product'] = new mongoose.Types.ObjectId(productId)
    }
    
    // Only apply date filtering if date parameters are explicitly provided
    if (startDate || endDate) {
      matchStage.createdAt = {}
      if (startDate) matchStage.createdAt.$gte = new Date(startDate)
      if (endDate) matchStage.createdAt.$lte = new Date(endDate)
      console.log('📅 DATE FILTER ACTIVE - Applying date filter:', { startDate, endDate })
    } else {
      console.log('📅 NO DATE FILTER - Returning ALL products with complete sales history (ignoring any date restrictions)')
    }
    
    console.log('🔍 Sales match criteria:', JSON.stringify(matchStage, null, 2))
    
    const salesData = await Sale.aggregate([
      { $match: matchStage },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          productName: { $first: '$items.productName' },
          totalQuantitySold: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.totalPrice' },
          salesCount: { $sum: 1 },
          lastSaleDate: { $max: '$createdAt' },
          // Add debugging fields
          avgUnitPrice: { $avg: '$items.unitPrice' },
          minUnitPrice: { $min: '$items.unitPrice' },
          maxUnitPrice: { $max: '$items.unitPrice' }
        }
      }
    ])
    
    console.log(`📊 Found ${salesData.length} products with sales data matching criteria`)
    
    // Create a map of sales data for quick lookup
    const salesMap = new Map()
    salesData.forEach(sale => {
      salesMap.set(sale._id?.toString(), sale)
    })
    
    // Debug: Log sample sales data
    if (salesData.length > 0) {
      console.log('📋 Sample sales data:', JSON.stringify(salesData[0], null, 2))
    }
    
    // Combine product data with sales data
    const combinedData: ProductSalesData[] = allProducts.map(product => {
      const productId = product._id.toString()
      const sales = salesMap.get(productId) || {
        totalQuantitySold: 0,
        totalRevenue: 0,
        salesCount: 0,
        lastSaleDate: null
      }
      
      const cost = product.cost || 0
      const totalCost = cost * sales.totalQuantitySold
      const profit = sales.totalRevenue - totalCost
      const profitMargin = sales.totalRevenue > 0 ? (profit / sales.totalRevenue) * 100 : 0
      
      // Debug logging for products with sales
      if (sales.totalQuantitySold > 0) {
        const avgPrice = sales.avgUnitPrice || 0
        const expectedRevenue = sales.totalQuantitySold * avgPrice
        const revenueMatch = Math.abs(expectedRevenue - sales.totalRevenue) < 0.01
        
        console.log(`💰 ${product.name}:`)
        console.log(`   📦 Units Sold: ${sales.totalQuantitySold}`)
        console.log(`   💵 Total Revenue: ₱${sales.totalRevenue}`)
        console.log(`   💲 Avg Unit Price: ₱${avgPrice}`)
        console.log(`   🧮 Expected Revenue: ₱${expectedRevenue} ${revenueMatch ? '✅' : '❌'}`)
        console.log(`   💸 Unit Cost: ₱${cost}`)
        console.log(`   📊 Total Cost: ₱${totalCost}`)
        console.log(`   💰 Profit: ₱${profit}`)
        console.log(`   📈 Margin: ${profitMargin.toFixed(1)}%`)
        console.log(`   🔢 Sales Count: ${sales.salesCount}`)
        
        if (!revenueMatch) {
          console.warn(`⚠️ Revenue mismatch for ${product.name}! Expected: ₱${expectedRevenue}, Actual: ₱${sales.totalRevenue}`)
        }
      }
      
      return {
        _id: productId,
        productName: product.name,
        currentStock: product.quantity || 0,
        price: product.price,
        cost: product.cost,
        category: product.category,
        seller: product.seller || 'N/A',
        totalQuantitySold: sales.totalQuantitySold,
        totalRevenue: sales.totalRevenue,
        salesCount: sales.salesCount,
        profit: profit,
        profitMargin: profitMargin,
        lastSaleDate: sales.lastSaleDate
      }
    })
    
    // Sort by total quantity sold (descending), then by product name
    combinedData.sort((a, b) => {
      if (b.totalQuantitySold !== a.totalQuantitySold) {
        return b.totalQuantitySold - a.totalQuantitySold
      }
      return a.productName.localeCompare(b.productName)
    })
    
    const dateRangeText = startDate || endDate ? `for date range ${startDate || 'start'} to ${endDate || 'end'}` : 'with complete sales history'
    console.log(`📊 All Products Report: Found ${combinedData.length} products ${dateRangeText} for store ${authContext.store.storeName}`)
    
    return NextResponse.json(combinedData)
  } catch (error: unknown) {
    console.error('Error generating all products report:', error)
    return NextResponse.json(
      { message: 'Error generating all products report', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
