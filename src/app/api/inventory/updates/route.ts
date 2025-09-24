import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// GET /api/inventory/updates - Get current inventory for specified products
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const productIdsParam = searchParams.get('productIds')
    
    if (!productIdsParam) {
      return NextResponse.json({ updates: [] })
    }
    
    const productIds = productIdsParam.split(',').filter(id => id.length === 24)
    
    if (productIds.length === 0) {
      return NextResponse.json({ updates: [] })
    }
    
    // Find products that belong to the authenticated store
    const products = await Product.find({
      _id: { $in: productIds },
      storeId: authContext.store._id
    }).select('_id quantity')
    
    const updates = products.map(product => ({
      productId: product._id.toString(),
      quantity: product.quantity
    }))
    
    return NextResponse.json({ updates })
  } catch (error: any) {
    console.error('Error fetching inventory updates:', error)
    return NextResponse.json(
      { message: 'Error fetching inventory updates', error: error.message },
      { status: 500 }
    )
  }
}