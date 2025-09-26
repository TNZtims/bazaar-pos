import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Cart from '@/models/Cart'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// PUT /api/cart/items - Update cart item quantity
export async function PUT(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const body = await request.json()
    const { productId, quantity } = body
    
    if (!productId || quantity < 0) {
      return NextResponse.json(
        { message: 'Product ID and valid quantity are required' },
        { status: 400 }
      )
    }
    
    // Find cart
    const cart = await Cart.findOne({
      userId: authContext.user._id,
      storeId: authContext.store._id
    })
    
    if (!cart) {
      return NextResponse.json(
        { message: 'Cart not found' },
        { status: 404 }
      )
    }
    
    // Find item in cart
    const itemIndex = cart.items.findIndex(
      item => item.product.toString() === productId
    )
    
    if (itemIndex === -1) {
      return NextResponse.json(
        { message: 'Item not found in cart' },
        { status: 404 }
      )
    }
    
    if (quantity === 0) {
      // Remove item from cart
      cart.items.splice(itemIndex, 1)
    } else {
      // Validate stock availability
      const product = await Product.findById(productId)
      if (!product) {
        return NextResponse.json(
          { message: 'Product not found' },
          { status: 404 }
        )
      }
      
      if (product.quantity < quantity) {
        return NextResponse.json(
          { message: `Insufficient stock. Available: ${product.quantity}` },
          { status: 400 }
        )
      }
      
      // Update quantity
      cart.items[itemIndex].quantity = quantity
      cart.items[itemIndex].unitPrice = product.price // Update price
      cart.items[itemIndex].reservedAt = new Date()
    }
    
    // Extend cart expiration
    cart.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    
    await cart.save()
    
    return NextResponse.json({ 
      message: quantity === 0 ? 'Item removed from cart' : 'Cart item updated',
      cartItemCount: cart.items.length
    })
    
  } catch (error) {
    console.error('Error updating cart item:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE /api/cart/items - Remove item from cart
export async function DELETE(request: NextRequest) {
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
    const productId = searchParams.get('productId')
    
    if (!productId) {
      return NextResponse.json(
        { message: 'Product ID is required' },
        { status: 400 }
      )
    }
    
    // Find cart
    const cart = await Cart.findOne({
      userId: authContext.user._id,
      storeId: authContext.store._id
    })
    
    if (!cart) {
      return NextResponse.json(
        { message: 'Cart not found' },
        { status: 404 }
      )
    }
    
    // Remove item from cart
    const originalLength = cart.items.length
    cart.items = cart.items.filter(item => item.product.toString() !== productId)
    
    if (cart.items.length === originalLength) {
      return NextResponse.json(
        { message: 'Item not found in cart' },
        { status: 404 }
      )
    }
    
    // Extend cart expiration
    cart.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
    
    await cart.save()
    
    return NextResponse.json({ 
      message: 'Item removed from cart',
      cartItemCount: cart.items.length
    })
    
  } catch (error) {
    console.error('Error removing cart item:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
