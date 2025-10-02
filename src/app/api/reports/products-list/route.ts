import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// GET /api/reports/products-list - Get list of products for filter dropdown
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
    
    // Get all products for the store
    const products = await Product.find({ 
      storeId: authContext.store._id 
    })
    .select('_id name category')
    .sort({ name: 1 })
    
    const productList = products.map(product => ({
      _id: product._id.toString(),
      name: product.name,
      category: product.category
    }))
    
    console.log(`📊 Found ${productList.length} products for store ${authContext.store.storeName}`)
    
    return NextResponse.json(productList)
  } catch (error: unknown) {
    console.error('Error fetching products list:', error)
    return NextResponse.json(
      { message: 'Error fetching products list', error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
