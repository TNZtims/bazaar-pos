import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import Cart from '@/models/Cart'
import { authenticateRequest, authenticateCustomerRequest } from '@/lib/auth'

// GET /api/products - Get all products with optional search and pagination
export async function GET(request: NextRequest) {
  try {
    // Check if this is a request from admin pages (sales or products management)
    const referer = request.headers.get('referer') || ''
    const isAdminPageRequest = referer.includes('/sales') || referer.includes('/products')
    
    let authContext: any = null
    let isCustomer = true
    
    if (isAdminPageRequest) {
      // For admin page requests (sales/products), ONLY use admin authentication
      console.log('🔒 Products API: Admin page request detected - using ADMIN auth only')
      authContext = await authenticateRequest(request)
      isCustomer = false
      
      if (!authContext) {
        console.log('❌ Products API: Admin authentication failed for admin page')
        return NextResponse.json(
          { message: 'Admin authentication required for admin pages' },
          { status: 401 }
        )
      }
    } else {
      // For public store requests, try customer authentication first, then admin
      authContext = await authenticateCustomerRequest(request)
      isCustomer = true
      
      if (!authContext) {
        // Fall back to admin authentication for store management
        authContext = await authenticateRequest(request)
        isCustomer = false
      }
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
    console.log(`🔍 Products API: Filtering products for store ${authContext.store.storeName} (ID: ${authContext.store._id})`)
    
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
    
    const response = NextResponse.json({
      products: productsWithAvailability,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    })
    
    // Add no-cache headers to prevent caching of product data
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
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
    
    // Broadcast new product creation via WebSocket
    console.log('🔍 Checking WebSocket availability:', {
      hasGlobalIo: !!(global as any).io,
      storeId: authContext.store._id,
      productName: savedProduct.name
    })
    
    if ((global as any).io) {
      try {
        // Broadcast inventory change for existing listeners
        (global as any).io.to(`store-${authContext.store._id}`).emit('inventory-changed', {
          productId: (savedProduct._id as any).toString(),
          quantity: savedProduct.quantity,
          timestamp: new Date().toISOString()
        });
        console.log('📡 Broadcasted inventory-changed event');
        
        // Broadcast new product creation with full details
        (global as any).io.to(`store-${authContext.store._id}`).emit('product-created', {
          product: {
            _id: (savedProduct._id as any).toString(),
            name: savedProduct.name,
            price: savedProduct.price,
            cost: savedProduct.cost,
            quantity: savedProduct.quantity,
            availableForPreorder: savedProduct.availableForPreorder,
            description: savedProduct.description,
            category: savedProduct.category,
            sku: savedProduct.sku,
            seller: savedProduct.seller,
            imageUrl: savedProduct.imageUrl,
            storeId: (savedProduct.storeId as any).toString(),
            createdAt: savedProduct.createdAt,
            updatedAt: savedProduct.updatedAt
          },
          timestamp: new Date().toISOString()
        });
        console.log('📡 Broadcasted product-created event');
        
        console.log(`📦 Broadcasted new product creation: ${savedProduct.name} (ID: ${savedProduct._id})`);
      } catch (wsError) {
        console.error('❌ WebSocket broadcasting error:', wsError)
      }
    } else {
      console.log('❌ WebSocket server not available - cannot broadcast product creation')
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
