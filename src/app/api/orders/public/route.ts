import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import { authenticateCustomerRequest } from '@/lib/auth'

// GET /api/orders/public - Get customer's orders
export async function GET(request: NextRequest) {
  try {
    const customerAuth = await authenticateCustomerRequest(request)
    
    if (!customerAuth) {
      return NextResponse.json(
        { message: 'Customer authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const status = searchParams.get('status')
    
    const query: any = {
      customerId: customerAuth.user._id,
      storeId: customerAuth.store._id
    }
    
    if (status) {
      query.approvalStatus = status
    }
    
    const orders = await Sale.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 })
    
    const total = await Sale.countDocuments(query)
    
    return NextResponse.json({
      orders,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    })
  } catch (error: any) {
    console.error('Error fetching customer orders:', error)
    return NextResponse.json(
      { message: 'Error fetching orders', error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/orders/public - Create new customer order
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
    
    const body = await request.json()
    const { items, notes } = body
    
    // Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: 'Order items are required' },
        { status: 400 }
      )
    }
    
    // Validate and calculate totals
    let subtotal = 0
    const validatedItems = []
    
    for (const item of items) {
      const product = await Product.findById(item.productId)
      if (!product) {
        return NextResponse.json(
          { message: `Product not found: ${item.productId}` },
          { status: 400 }
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
    
    // Create order (pending approval)
    const order = new Sale({
      items: validatedItems,
      totalAmount: subtotal,
      subtotal: subtotal,
      tax: 0,
      discount: 0,
      finalAmount: subtotal,
      paymentStatus: 'pending',
      paymentMethod: 'cash', // Default to cash, will be updated when payment is made
      amountPaid: 0,
      amountDue: subtotal,
      payments: [],
      customerName: customerAuth.user.name,
      customerId: customerAuth.user._id,
      customerCustomId: customerAuth.user.customId,
      notes: notes || '',
      status: 'pending',
      approvalStatus: 'pending',
      storeId: customerAuth.store._id
    })
    
    const savedOrder = await order.save()
    
    // Convert reserved stock to confirmed sale - reduce total quantity and reserved quantity
    // The availableQuantity will be automatically updated by the Product middleware
    for (const item of validatedItems) {
      const product = await Product.findByIdAndUpdate(
        item.product,
        { 
          $inc: { 
            totalQuantity: -item.quantity,
            reservedQuantity: -item.quantity  // Release the reservation since it's now a confirmed order
          }
        },
        { new: true }
      )
      
      if (!product) {
        console.error(`Failed to update product ${item.product} after order creation`)
      }
    }
    
    return NextResponse.json({
      message: 'Order placed successfully. Waiting for admin approval.',
      order: {
        id: savedOrder._id,
        items: savedOrder.items,
        totalAmount: savedOrder.totalAmount,
        status: savedOrder.status,
        approvalStatus: savedOrder.approvalStatus,
        createdAt: savedOrder.createdAt
      }
    }, { status: 201 })
    
  } catch (error: any) {
    console.error('Error creating customer order:', error)
    return NextResponse.json(
      { message: 'Error creating order', error: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/orders/public - Delete customer's pending order
export async function DELETE(request: NextRequest) {
  try {
    const customerAuth = await authenticateCustomerRequest(request)
    
    if (!customerAuth) {
      return NextResponse.json(
        { message: 'Customer authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const orderId = searchParams.get('orderId')
    
    if (!orderId) {
      return NextResponse.json(
        { message: 'Order ID is required' },
        { status: 400 }
      )
    }
    
    // Find the order and verify ownership
    const order = await Sale.findOne({
      _id: orderId,
      customerId: customerAuth.user._id,
      storeId: customerAuth.store._id
    })
    
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found' },
        { status: 404 }
      )
    }
    
    // Only allow deletion of pending orders
    if (order.approvalStatus !== 'pending' || order.status !== 'pending') {
      return NextResponse.json(
        { message: 'Can only delete pending orders' },
        { status: 400 }
      )
    }
    
    // Restore product quantities (both total and reserved)
    for (const item of order.items) {
      const product = await Product.findById(item.product)
      if (product) {
        // Add back to total quantity and reduce reserved quantity
        await Product.findByIdAndUpdate(
          item.product,
          { 
            $inc: { 
              totalQuantity: item.quantity,
              reservedQuantity: -item.quantity 
            }
          }
        )
      }
    }
    
    await Sale.findByIdAndDelete(orderId)
    
    return NextResponse.json({ message: 'Order deleted successfully' })
    
  } catch (error: any) {
    console.error('Error deleting customer order:', error)
    return NextResponse.json(
      { message: 'Error deleting order', error: error.message },
      { status: 500 }
    )
  }
}
