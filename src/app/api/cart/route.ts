import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Cart from '@/models/Cart'
import Product from '@/models/Product'
import { authenticateRequest, authenticateCustomerRequest } from '@/lib/auth'

// GET /api/cart - Get user's cart
export async function GET(request: NextRequest) {
  try {
    // Check if this is a request from admin pages (sales or products management)
    const referer = request.headers.get('referer') || ''
    const isAdminPageRequest = referer.includes('/sales') || referer.includes('/products')
    
    let authContext: any = null
    let isCustomer = true
    
    if (isAdminPageRequest) {
      // For admin page requests (sales/products), ONLY use admin authentication
      console.log('🔒 Cart API: Admin page request detected - using ADMIN auth only')
      authContext = await authenticateRequest(request)
      isCustomer = false
      
      if (!authContext) {
        console.log('❌ Cart API: Admin authentication failed for admin page')
        return NextResponse.json(
          { message: 'Admin authentication required for admin page' },
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
    
    if (!authContext) {
      // console.log('⚠️ Cart authentication failed, using fallback mode')
      // Return empty cart for development when authentication fails
      return NextResponse.json({
        items: [],
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        notes: '',
        tax: 0,
        discount: 0,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        amountPaid: 0,
        dueDate: null,
        selectedCashier: '',
        message: 'Authentication required - please login first'
      })
    }
    
    await connectToDatabase()
    
    // Return empty cart for now - simplifying to avoid model issues
    const emptyCartResponse = {
      items: [],
      customerName: '',
      customerPhone: '',
      customerEmail: '',
      notes: '',
      tax: 0,
      discount: 0,
      paymentMethod: 'cash',
      paymentStatus: 'paid',
      amountPaid: 0,
      dueDate: null,
      selectedCashier: ''
    }
    
    // Try to find cart, but don't fail if there are issues
    try {
      let cart
      if (isCustomer && 'user' in authContext) {
        // Customer authentication - look for user's cart
        cart = await Cart.findOne({
          userId: authContext.user._id,
          storeId: authContext.store._id
        })
      } else {
        // Admin authentication - return empty cart for now (or could show all carts)
        cart = null
      }
      
      if (!cart) {
        const response = NextResponse.json(emptyCartResponse)
        // Add no-cache headers to prevent caching of cart data
        response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
        response.headers.set('Pragma', 'no-cache')
        response.headers.set('Expires', '0')
        return response
      }
      
      // Return cart data without complex validation for now
      const cartResponse = NextResponse.json({
        items: cart.items.map(item => ({
          product: {
            _id: item.product,
            name: item.productName,
            price: item.unitPrice,
            quantity: 0, // Will be updated by the frontend
            availableQuantity: 0, // Will be updated by the frontend
          },
          quantity: item.quantity
        })),
        customerName: cart.customerName || '',
        customerPhone: cart.customerPhone || '',
        customerEmail: cart.customerEmail || '',
        notes: cart.notes || '',
        tax: cart.tax || 0,
        discount: cart.discount || 0,
        paymentMethod: cart.paymentMethod || 'cash',
        paymentStatus: cart.paymentStatus || 'paid',
        amountPaid: cart.amountPaid || 0,
        dueDate: cart.dueDate || null,
        selectedCashier: cart.selectedCashier || ''
      })
      
      // Add no-cache headers to prevent caching of cart data
      cartResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      cartResponse.headers.set('Pragma', 'no-cache')
      cartResponse.headers.set('Expires', '0')
      
      return cartResponse
      
    } catch (cartError) {
      console.error('Error with cart operations:', cartError)
      // Return empty cart if there are any issues
      const errorResponse = NextResponse.json(emptyCartResponse)
      errorResponse.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      errorResponse.headers.set('Pragma', 'no-cache')
      errorResponse.headers.set('Expires', '0')
      return errorResponse
    }
    
  } catch (error) {
    console.error('Error fetching cart:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json(
      { 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Cart fetch failed'
      },
      { status: 500 }
    )
  }
}

// POST /api/cart - Add item to cart
export async function POST(request: NextRequest) {
  try {
    // Check if this is a request from admin pages (sales or products management)
    const referer = request.headers.get('referer') || ''
    const isAdminPageRequest = referer.includes('/sales') || referer.includes('/products')
    
    let authContext: any = null
    let isCustomer = true
    
    if (isAdminPageRequest) {
      // For admin page requests (sales/products), ONLY use admin authentication
      console.log('🔒 Cart POST API: Admin page request detected - using ADMIN auth only')
      authContext = await authenticateRequest(request)
      isCustomer = false
      
      if (!authContext) {
        console.log('❌ Cart POST API: Admin authentication failed for admin page')
        return NextResponse.json(
          { message: 'Admin authentication required for admin page' },
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
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const body = await request.json()
    const { productId, quantity, items } = body
    
    // Handle bulk cart update (from public shop)
    if (items && Array.isArray(items)) {
      // console.log('🛒 Bulk cart update received:', { items, authContext: !!authContext })
      
      // Validate all items
      for (const item of items) {
        // Validating item: product, quantity, productName, unitPrice
        
        if (!item.product || !item.quantity || item.quantity <= 0) {
          console.error('❌ Invalid item format:', item)
          return NextResponse.json(
            { message: 'Invalid item format in bulk update', details: item },
            { status: 400 }
          )
        }
      }
      
      // Use findOneAndUpdate with upsert to avoid version conflicts
      const cart = await Cart.findOneAndUpdate(
        {
          userId: authContext.user._id,
          storeId: authContext.store._id
        },
        {
          $set: {
            items: items.map((item: any) => ({
              product: item.product,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice
            })),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Extend expiration
          },
          $setOnInsert: {
            customerName: '',
            customerPhone: '',
            customerEmail: '',
            notes: '',
            tax: 0,
            discount: 0,
            paymentMethod: 'cash',
            paymentStatus: 'paid',
            amountPaid: 0,
            dueDate: null,
            selectedCashier: ''
          }
        },
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      )
      
      return NextResponse.json({
        message: 'Cart updated successfully',
        items: cart.items
      })
    }
    
    // Handle individual item addition (original functionality)
    if (!productId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { message: 'Product ID and quantity are required' },
        { status: 400 }
      )
    }
    
    // Validate product
    const product = await Product.findOne({
      _id: productId,
      storeId: authContext.store._id
    })
    
    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }
    
    // Check stock availability
    if (product.quantity < quantity) {
      return NextResponse.json(
        { message: `Insufficient stock. Available: ${product.quantity}` },
        { status: 400 }
      )
    }
    
    if (!isCustomer || !('user' in authContext)) {
      // Admin users can't add to cart directly
      return NextResponse.json(
        { message: 'Admin users cannot add items to cart' },
        { status: 403 }
      )
    }
    
    // Use atomic update to avoid version conflicts
    let cart = await Cart.findOne({
      userId: authContext.user._id,
      storeId: authContext.store._id
    })
    
    if (!cart) {
      // Create new cart
      cart = await Cart.create({
        userId: authContext.user._id,
        storeId: authContext.store._id,
        items: [{
          product: product._id,
          productName: product.name,
          quantity: quantity,
          unitPrice: product.price,
          reservedAt: new Date()
        }],
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      })
    } else {
      // Update existing cart atomically
      const existingItemIndex = cart.items.findIndex(
        item => item.product.toString() === productId
      )
      
      if (existingItemIndex >= 0) {
        // Update existing item
        const newQuantity = cart.items[existingItemIndex].quantity + quantity
        
        // Check total stock availability
        if (product.quantity < newQuantity) {
          return NextResponse.json(
            { message: `Insufficient stock. Available: ${product.quantity}, in cart: ${cart.items[existingItemIndex].quantity}` },
            { status: 400 }
          )
        }
        
        cart = await Cart.findOneAndUpdate(
          { _id: cart._id },
          {
            $set: {
              [`items.${existingItemIndex}.quantity`]: newQuantity,
              [`items.${existingItemIndex}.unitPrice`]: product.price,
              [`items.${existingItemIndex}.reservedAt`]: new Date(),
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          },
          { new: true }
        )
      } else {
        // Add new item
        cart = await Cart.findOneAndUpdate(
          { _id: cart._id },
          {
            $push: {
              items: {
                product: product._id,
                productName: product.name,
                quantity: quantity,
                unitPrice: product.price,
                reservedAt: new Date()
              }
            },
            $set: {
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
            }
          },
          { new: true }
        )
      }
    }
    
    return NextResponse.json({ 
      message: 'Item added to cart',
      cartItemCount: cart.items.length
    })
    
  } catch (error) {
    console.error('Error adding to cart:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT /api/cart - Update cart (items, customer info, etc.)
export async function PUT(request: NextRequest) {
  try {
    // Check if this is a request from admin pages (sales or products management)
    const referer = request.headers.get('referer') || ''
    const isAdminPageRequest = referer.includes('/sales') || referer.includes('/products')
    
    let authContext: any = null
    let isCustomer = true
    
    if (isAdminPageRequest) {
      // For admin page requests (sales/products), ONLY use admin authentication
      console.log('🔒 Cart PUT API: Admin page request detected - using ADMIN auth only')
      authContext = await authenticateRequest(request)
      isCustomer = false
      
      if (!authContext) {
        console.log('❌ Cart PUT API: Admin authentication failed for admin page')
        return NextResponse.json(
          { message: 'Admin authentication required for admin page' },
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
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    let body
    try {
      body = await request.json()
    } catch (jsonError) {
      console.error('Error parsing request body:', jsonError)
      return NextResponse.json(
        { message: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const { 
      items, 
      customerName, 
      customerPhone, 
      customerEmail, 
      notes,
      tax,
      discount,
      paymentMethod,
      paymentStatus,
      amountPaid,
      dueDate,
      selectedCashier
    } = body
    
    // Find or create cart with better error handling
    let cart
    if (isCustomer && 'user' in authContext) {
      try {
        cart = await Cart.findOne({
          userId: authContext.user._id,
          storeId: authContext.store._id
        })
      } catch (findError) {
        console.error('Error finding cart:', findError)
        return NextResponse.json(
          { message: 'Database error while finding cart' },
          { status: 500 }
        )
      }
      
      if (!cart) {
        try {
          cart = new Cart({
            userId: authContext.user._id,
            storeId: authContext.store._id,
            items: []
          })
        } catch (createError) {
          console.error('Error creating cart:', createError)
          return NextResponse.json(
            { message: 'Error creating cart' },
            { status: 500 }
          )
        }
      }
    } else {
      // Admin users can't update customer carts directly
      return NextResponse.json(
        { message: 'Admin users cannot update customer carts' },
        { status: 403 }
      )
    }
    
    // Update cart data with validation
    try {
      if (items !== undefined) {
        // Validate items structure
        if (Array.isArray(items)) {
          cart.items = items.map(item => ({
            product: item.product,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            reservedAt: new Date()
          }))
        } else {
          cart.items = []
        }
      }
      
      if (customerName !== undefined) cart.customerName = customerName
      if (customerPhone !== undefined) cart.customerPhone = customerPhone
      if (customerEmail !== undefined) cart.customerEmail = customerEmail
      if (notes !== undefined) cart.notes = notes
      if (tax !== undefined) cart.tax = Number(tax) || 0
      if (discount !== undefined) cart.discount = Number(discount) || 0
      if (paymentMethod !== undefined) cart.paymentMethod = paymentMethod
      if (paymentStatus !== undefined) cart.paymentStatus = paymentStatus
      if (amountPaid !== undefined) cart.amountPaid = Number(amountPaid) || 0
      if (dueDate !== undefined) cart.dueDate = dueDate ? new Date(dueDate) : null
      if (selectedCashier !== undefined) cart.selectedCashier = selectedCashier
      
      // Extend cart expiration
      cart.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      
      await cart.save()
      
      return NextResponse.json({ message: 'Cart updated successfully' })
      
    } catch (updateError) {
      console.error('Error updating cart data:', updateError)
      console.error('Update error details:', {
        message: updateError.message,
        stack: updateError.stack,
        name: updateError.name
      })
      return NextResponse.json(
        { 
          message: 'Error updating cart data',
          error: process.env.NODE_ENV === 'development' ? updateError.message : 'Update failed'
        },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Error updating cart:', error)
    console.error('Cart update error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json(
      { 
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Cart update failed'
      },
      { status: 500 }
    )
  }
}

// DELETE /api/cart - Clear cart
export async function DELETE(request: NextRequest) {
  try {
    // Check if this is a request from admin pages (sales or products management)
    const referer = request.headers.get('referer') || ''
    const isAdminPageRequest = referer.includes('/sales') || referer.includes('/products')
    
    let authContext: any = null
    let isCustomer = true
    
    if (isAdminPageRequest) {
      // For admin page requests (sales/products), ONLY use admin authentication
      console.log('🔒 Cart DELETE API: Admin page request detected - using ADMIN auth only')
      authContext = await authenticateRequest(request)
      isCustomer = false
      
      if (!authContext) {
        console.log('❌ Cart DELETE API: Admin authentication failed for admin page')
        return NextResponse.json(
          { message: 'Admin authentication required for admin page' },
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
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    if (isCustomer && 'user' in authContext) {
      await Cart.findOneAndDelete({
        userId: authContext.user._id,
        storeId: authContext.store._id
      })
    } else {
      // Admin users can't delete customer carts directly
      return NextResponse.json(
        { message: 'Admin users cannot delete customer carts' },
        { status: 403 }
      )
    }
    
    return NextResponse.json({ message: 'Cart cleared successfully' })
    
  } catch (error) {
    console.error('Error clearing cart:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
