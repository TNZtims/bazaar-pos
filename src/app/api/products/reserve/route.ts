import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateCustomerRequest } from '@/lib/auth'

// POST /api/products/reserve - Reserve or release stock for cart items
export async function POST(request: NextRequest) {
  try {
    const customerAuth = await authenticateCustomerRequest(request)
    
    if (!customerAuth) {
      return NextResponse.json(
        { message: 'Customer authentication required' },
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
      storeId: customerAuth.store._id 
    })
    
    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }
    
    if (action === 'reserve') {
      // Check if we have enough available stock to reserve
      if (product.availableQuantity < quantity) {
        return NextResponse.json(
          { 
            message: `Insufficient stock available. Available: ${product.availableQuantity}, Requested: ${quantity}` 
          },
          { status: 400 }
        )
      }
      
      // Reserve stock by increasing reserved quantity and decreasing available quantity
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { 
          $inc: { 
            reservedQuantity: quantity,
            availableQuantity: -quantity 
          }
        },
        { new: true }
      )
      
      return NextResponse.json({
        message: 'Stock reserved successfully',
        product: {
          id: updatedProduct._id,
          name: updatedProduct.name,
          totalQuantity: updatedProduct.totalQuantity,
          availableQuantity: updatedProduct.availableQuantity,
          reservedQuantity: updatedProduct.reservedQuantity
        }
      })
      
    } else if (action === 'release') {
      // Release reserved stock by decreasing reserved quantity and increasing available quantity
      // Make sure we don't release more than what's reserved
      const releaseQuantity = Math.min(quantity, product.reservedQuantity)
      
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        { 
          $inc: { 
            reservedQuantity: -releaseQuantity,
            availableQuantity: releaseQuantity 
          }
        },
        { new: true }
      )
      
      return NextResponse.json({
        message: 'Stock released successfully',
        product: {
          id: updatedProduct._id,
          name: updatedProduct.name,
          totalQuantity: updatedProduct.totalQuantity,
          availableQuantity: updatedProduct.availableQuantity,
          reservedQuantity: updatedProduct.reservedQuantity
        }
      })
    }
    
  } catch (error: any) {
    console.error('Error managing stock reservation:', error)
    return NextResponse.json(
      { message: 'Error managing stock reservation', error: error.message },
      { status: 500 }
    )
  }
}
