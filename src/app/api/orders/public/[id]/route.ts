import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import { authenticateCustomerRequest } from '@/lib/auth'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const customerAuth = await authenticateCustomerRequest(request)
    
    if (!customerAuth) {
      return NextResponse.json(
        { message: 'Customer authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { id } = params
    const body = await request.json()
    const { items, notes } = body
    
    // Find the existing order
    const existingOrder = await Sale.findOne({
      _id: id,
      customerId: customerAuth.user._id,
      status: 'pending',
      approvalStatus: 'pending'
    })
    
    if (!existingOrder) {
      return NextResponse.json(
        { message: 'Order not found or cannot be edited' },
        { status: 404 }
      )
    }
    
    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: 'Order items are required' },
        { status: 400 }
      )
    }
    
    // Restore quantities from old order (since all orders immediately reduce quantities)
    for (const oldItem of existingOrder.items) {
      await Product.findByIdAndUpdate(
        oldItem.product,
        { 
          $inc: { totalQuantity: oldItem.quantity }
        }
      )
    }
    
    // Validate new items and calculate totals
    let subtotal = 0
    const validatedItems = []
    
    for (const item of items) {
      const product = await Product.findById(item.productId)
      if (!product) {
        return NextResponse.json(
          { message: `Product not found: ${item.productId}` },
          { status: 404 }
        )
      }
      
      if (product.storeId.toString() !== customerAuth.store._id.toString()) {
        return NextResponse.json(
          { message: 'Product not available in this store' },
          { status: 400 }
        )
      }
      
      if (product.availableQuantity < item.quantity) {
        return NextResponse.json(
          { message: `Insufficient stock for ${product.name}. Available: ${product.availableQuantity}, Total: ${product.totalQuantity}, Reserved: ${product.reservedQuantity}` },
          { status: 400 }
        )
      }
      
      const itemTotal = product.price * item.quantity
      subtotal += itemTotal
      
      validatedItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal
      })
    }
    
    // First, restore inventory from the original order
    for (const originalItem of existingOrder.items) {
      await Product.findByIdAndUpdate(
        originalItem.product,
        { 
          $inc: { 
            totalQuantity: originalItem.quantity,
            reservedQuantity: -originalItem.quantity 
          }
        }
      )
    }
    
    // Then, deduct inventory for the updated order
    for (const item of validatedItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { 
          $inc: { 
            totalQuantity: -item.quantity,
            reservedQuantity: item.quantity 
          }
        }
      )
    }
    
    // Update the order
    existingOrder.items = validatedItems
    existingOrder.totalAmount = subtotal
    existingOrder.subtotal = subtotal
    existingOrder.finalAmount = subtotal
    existingOrder.amountDue = subtotal
    existingOrder.notes = notes || existingOrder.notes
    
    const updatedOrder = await existingOrder.save()
    
    return NextResponse.json({
      message: 'Order updated successfully.',
      order: {
        id: updatedOrder._id,
        items: updatedOrder.items,
        totalAmount: updatedOrder.totalAmount,
        status: updatedOrder.status,
        approvalStatus: updatedOrder.approvalStatus,
        createdAt: updatedOrder.createdAt
      }
    })
    
  } catch (error: any) {
    console.error('Error updating customer order:', error)
    return NextResponse.json(
      { message: 'Error updating order', error: error.message },
      { status: 500 }
    )
  }
}
