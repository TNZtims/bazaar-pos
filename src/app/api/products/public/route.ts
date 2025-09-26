import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateCustomerRequest } from '@/lib/auth'

// GET /api/products/public - Get products for customers
export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const search = searchParams.get('search')
    const category = searchParams.get('category')
    const preorderOnly = searchParams.get('preorderOnly') === 'true'
    const storeName = searchParams.get('store')
    
    const query: any = {}
    
    // Handle store filtering
    if (storeName) {
      // Find store by name for public access
      const Store = (await import('@/models/Store')).default
      const store = await Store.findOne({ storeName: storeName, isActive: true })
      if (!store) {
        return NextResponse.json(
          { message: 'Store not found or inactive' },
          { status: 404 }
        )
      }
      
      // Check if store is locked (closed to public)
      if (store.isLocked) {
        return NextResponse.json({
          products: [],
          totalPages: 0,
          currentPage: page,
          total: 0,
          accessible: false,
          message: 'Store is currently closed to public access'
        })
      }
      
      query.storeId = store._id
    } else {
      // Try customer authentication for authenticated requests
      const customerAuth = await authenticateCustomerRequest(request)
      if (customerAuth) {
        query.storeId = customerAuth.store._id
      } else {
        return NextResponse.json(
          { message: 'Store parameter required for public access' },
          { status: 400 }
        )
      }
    }
    
    // Filter by preorder availability
    if (preorderOnly) {
      query.availableForPreorder = true
    }
    // Remove quantity filter - show all products including sold out ones
    // The frontend will handle displaying them as disabled
    
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
      .select('name price quantity availableForPreorder description category seller imageUrl')
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ name: 1 })
    
    const total = await Product.countDocuments(query)
    
    // Handle cart-aware availability calculation for authenticated users
    const includeCart = searchParams.get('includeCart') === 'true'
    let userCart = null
    
    if (includeCart && storeName) {
      // For public access with cart data, we need to get the user's cart
      const customerAuth = await authenticateCustomerRequest(request)
      if (customerAuth) {
        try {
          const Cart = (await import('@/models/Cart')).default
          userCart = await Cart.findOne({
            userId: customerAuth.user._id,
            storeId: customerAuth.store._id
          })
        } catch (cartError) {
          console.error('Error fetching user cart:', cartError)
        }
      }
    }
    
    // Calculate availability considering cart reservations
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
      
      // For public shop, use the same logic as sales page:
      // product.quantity is already reduced by confirmed orders
      // We only subtract cart reservations for items not yet confirmed
      const availableQuantity = Math.max(0, product.quantity - reservedQuantity)
      
      return {
        ...productObj,
        availableQuantity,
        totalQuantity: product.quantity,
        reservedQuantity: includeCart ? reservedQuantity : 0
      }
    })
    
    // For preorderOnly requests, return products in expected format
    if (preorderOnly) {
      return NextResponse.json({
        products: productsWithAvailability,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total
      })
    }
    
    return NextResponse.json({
      products: productsWithAvailability,
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
