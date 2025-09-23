import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// GET /api/products - Get all products with optional search and pagination
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    
    const query: any = {}
    
    // Filter by store - only show products from the authenticated store
    query.storeId = authContext.store._id
    
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
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
    
    const total = await Product.countDocuments(query)
    
    return NextResponse.json({
      products,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error fetching products', error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/products - Create new product
export async function POST(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const body = await request.json()
    const { name, price, cost, quantity, totalQuantity, description, category, sku, seller, imageUrl } = body
    
    // Use totalQuantity if provided, otherwise fall back to quantity for backward compatibility
    const finalQuantity = totalQuantity !== undefined ? totalQuantity : quantity
    
    // Validation
    if (!name || !price || finalQuantity === undefined) {
      return NextResponse.json(
        { message: 'Name, price, and quantity are required' },
        { status: 400 }
      )
    }
    
    const product = new Product({
      name,
      price,
      cost,
      totalQuantity: finalQuantity,
      reservedQuantity: 0, // Default to 0 for new products
      description,
      category,
      sku,
      seller,
      imageUrl,
      storeId: authContext.store._id
    })
    
    const savedProduct = await product.save()
    
    return NextResponse.json(savedProduct, { status: 201 })
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'SKU already exists in this store' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { message: 'Error creating product', error: error.message },
      { status: 500 }
    )
  }
}
