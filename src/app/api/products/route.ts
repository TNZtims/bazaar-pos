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
    const preorderOnly = searchParams.get('preorderOnly') === 'true'
    
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

    // Preorder only filter
    if (preorderOnly) {
      query.availableForPreorder = true
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
    const { name, price, cost, quantity, description, category, sku, seller, imageUrl, availableForPreorder } = body
    
    // Validation
    if (!name || !price || quantity === undefined) {
      return NextResponse.json(
        { message: 'Name, price, and quantity are required' },
        { status: 400 }
      )
    }
    
    const product = new Product({
      name,
      price,
      cost,
      quantity: quantity || 0,
      availableForPreorder: availableForPreorder || false,
      description,
      category,
      sku,
      seller,
      imageUrl,
      storeId: authContext.store._id
    })
    
    const savedProduct = await product.save()
    
    // Broadcast inventory update via WebSocket
    if ((global as any).io) {
      (global as any).io.to(`store-${authContext.store._id}`).emit('inventory-changed', {
        productId: (savedProduct._id as any).toString(),
        quantity: savedProduct.quantity,
        timestamp: new Date().toISOString()
      })
    }
    
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
