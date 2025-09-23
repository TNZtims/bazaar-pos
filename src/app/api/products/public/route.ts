import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateCustomerRequest } from '@/lib/auth'

// GET /api/products/public - Get products for customers
export async function GET(request: NextRequest) {
  try {
    const customerAuth = await authenticateCustomerRequest(request)
    
    if (!customerAuth) {
      return NextResponse.json(
        { message: 'Customer authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    
    const query: any = {}
    
    // Filter by store - only show products from the customer's store
    query.storeId = customerAuth.store._id
    
    // Only show products with quantity > 0
    query.quantity = { $gt: 0 }
    
    // Search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ]
    }
    
    // Category filter
    if (category) {
      query.category = category
    }
    
    const products = await Product.find(query)
      .select('name price quantity totalQuantity availableQuantity reservedQuantity description category seller imageUrl')
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ name: 1 })
    
    const total = await Product.countDocuments(query)
    
    return NextResponse.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    })
  } catch (error: any) {
    console.error('Error fetching public products:', error)
    return NextResponse.json(
      { message: 'Error fetching products', error: error.message },
      { status: 500 }
    )
  }
}
