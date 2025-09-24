import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// POST /api/products/admin-reserve - Reserve or release stock for admin cart items (simplified schema)
export async function POST(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    // Handle empty request body gracefully
    let body
    try {
      const text = await request.text()
      if (!text.trim()) {
        return NextResponse.json(
          { message: 'Request body is required' },
          { status: 400 }
        )
      }
      body = JSON.parse(text)
    } catch (parseError) {
      return NextResponse.json(
        { message: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const { productId, quantity, action } = body
    
    // Validation
    if (!productId || !quantity || !action) {
      return NextResponse.json(
        { message: 'Product ID, quantity, and action are required' },
        { status: 400 }
      )
    }
    
    if (!['reserve', 'release'].includes(action)) {
      return NextResponse.json(
        { message: 'Action must be either "reserve" or "release"' },
        { status: 400 }
      )
    }
    
    if (quantity <= 0) {
      return NextResponse.json(
        { message: 'Quantity must be greater than 0' },
        { status: 400 }
      )
    }
    
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
    
    if (action === 'reserve') {
      // Check if we have enough stock (simplified - just check quantity)
      if (product.quantity < quantity) {
        return NextResponse.json(
          { 
            message: `Insufficient stock available. Available: ${product.quantity}, Requested: ${quantity}` 
          },
          { status: 400 }
        )
      }
      
      // Reserve stock by reducing quantity
      const updatedProduct = await Product.findOneAndUpdate(
        { 
          _id: productId,
          storeId: authContext.store._id,
          quantity: { $gte: quantity } // Double-check in atomic operation
        },
        { 
          $inc: { quantity: -quantity }
        },
        { new: true }
      )
      
      if (!updatedProduct) {
        return NextResponse.json(
          { 
            message: `Insufficient stock available during reservation` 
          },
          { status: 400 }
        )
      }
      
      // Broadcast inventory update via WebSocket
      if ((global as any).io) {
        (global as any).io.to(`store-${String(authContext.store._id)}`).emit('inventory-changed', {
          productId: updatedProduct._id.toString(),
          quantity: updatedProduct.quantity,
          timestamp: new Date().toISOString()
        })
      }
      
      return NextResponse.json({
        message: 'Stock reserved successfully',
        availableQuantity: updatedProduct.quantity
      })
      
    } else if (action === 'release') {
      // Release stock by adding back to quantity
      const updatedProduct = await Product.findOneAndUpdate(
        { 
          _id: productId,
          storeId: authContext.store._id
        },
        { 
          $inc: { quantity: quantity }
        },
        { new: true }
      )
      
      if (!updatedProduct) {
        return NextResponse.json(
          { message: 'Failed to release stock' },
          { status: 400 }
        )
      }
      
      // Broadcast inventory update via WebSocket
      if ((global as any).io) {
        (global as any).io.to(`store-${String(authContext.store._id)}`).emit('inventory-changed', {
          productId: updatedProduct._id.toString(),
          quantity: updatedProduct.quantity,
          timestamp: new Date().toISOString()
        })
      }
      
      return NextResponse.json({
        message: 'Stock released successfully',
        availableQuantity: updatedProduct.quantity
      })
    }
    
  } catch (error: any) {
    console.error('Error in admin reserve/release:', error)
    return NextResponse.json(
      { message: 'Internal server error', error: error.message },
      { status: 500 }
    )
  }
}