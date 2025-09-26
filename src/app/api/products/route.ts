import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import Cart from '@/models/Cart'
import { authenticateRequest, authenticateCustomerRequest } from '@/lib/auth'

// GET /api/products - Get all products with optional search and pagination
export async function GET(request: NextRequest) {
  try {
    // Try customer authentication first, then admin authentication
    let authContext: any = await authenticateCustomerRequest(request)
    let isCustomer = true
    
    if (!authContext) {
      // Fall back to admin authentication for store management
      authContext = await authenticateRequest(request)
      isCustomer = false
    }
    
    // If authentication fails, provide a fallback for development
    if (!authContext) {
      // console.log('⚠️ Authentication failed, using fallback mode for development')
      
      // Try to connect to database anyway
      try {
        await connectToDatabase()
      } catch (dbError) {
        console.error('❌ Database connection failed in fallback mode:', (dbError as Error).message)
        return NextResponse.json(
          { 
            message: 'Database connection failed', 
            error: 'Please check your MongoDB connection',
            products: [],
            totalPages: 0,
            currentPage: 1,
            total: 0
          },
          { status: 500 }
        )
      }
      
      // Return sample data or empty array for development
      return NextResponse.json({
        products: [],
        totalPages: 0,
        currentPage: 1,
        total: 0,
        message: 'Authentication required - please login first'
      })
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
    
    // Calculate available quantities considering cart reservations for current user
    // Only do cart lookup if this is for sales page (has includeCart parameter or user agent suggests sales)
    const includeCart = searchParams.get('includeCart') === 'true'
    let userCart = null
    
    if (includeCart && isCustomer && 'user' in authContext) {
      try {
        userCart = await Cart.findOne({
          userId: authContext.user._id,
          storeId: authContext.store._id
        })
      } catch (cartError) {
        console.error('Error fetching user cart:', cartError)
        // Continue without cart data - will show full availability
      }
    }
    
    const productsWithAvailability = products.map(product => {
      const productObj = product.toObject()
      let reservedQuantity = 0
      
      if (userCart) {
        const cartItem = userCart.items.find(
          (item: any) => item.product.toString() === (product._id as any).toString()
        )
        if (cartItem) {
          reservedQuantity = cartItem.quantity
        }
      }
      
      // Calculate actual available quantity (total - reserved in user's cart)
      const availableQuantity = Math.max(0, product.quantity - reservedQuantity)
      
      return {
        ...productObj,
        availableQuantity,
        totalQuantity: product.quantity,
        reservedQuantity: includeCart ? reservedQuantity : 0
      }
    })
    
    return NextResponse.json({
      products: productsWithAvailability,
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
    const { name, price, cost, quantity, description, category, sku, seller, imageUrl } = body
    
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
      availableForPreorder: true,
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
