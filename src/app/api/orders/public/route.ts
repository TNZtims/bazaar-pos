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
      
      if (product.storeId.toString() !== String(customerAuth.store._id)) {
        return NextResponse.json(
          { message: 'Product not available in this store' },
          { status: 400 }
        )
      }
      
      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { message: `Insufficient stock for ${product.name}. Available: ${product.quantity}` },
          { status: 400 }
        )
      }
      
      // Use discount price if available, otherwise use regular price
      const effectivePrice = product.discountPrice && product.discountPrice > 0 ? product.discountPrice : product.price
      const itemTotal = effectivePrice * item.quantity
      subtotal += itemTotal
      
      validatedItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: effectivePrice,
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
    
    // Broadcast new order notification via WebSocket
    if ((global as any).io) {
      (global as any).io.to(`store-${String(customerAuth.store._id)}`).emit('order-created', {
        orderId: String(savedOrder._id),
        customerName: savedOrder.customerName,
        totalAmount: savedOrder.totalAmount,
        itemCount: savedOrder.items.length,
        status: savedOrder.status,
        approvalStatus: savedOrder.approvalStatus,
        timestamp: new Date().toISOString()
      })
      console.log(`📋 Broadcasted new order notification: ${savedOrder.customerName} - ₱${savedOrder.totalAmount}`)
    }
    
    // Since cart items were already reserved (quantity reduced), 
    // placing order doesn't need to reduce quantity again.
    // The quantity was already decremented when items were added to cart via reserve API
    
    // Broadcast inventory updates via WebSocket
    if ((global as any).io) {
      for (const item of validatedItems) {
        // Fetch updated product to get current quantities
        const updatedProduct = await Product.findById(item.product)
        if (updatedProduct) {
          (global as any).io.to(`store-${String(customerAuth.store._id)}`).emit('inventory-changed', {
            productId: String(updatedProduct._id),
            quantity: updatedProduct.quantity,
            timestamp: new Date().toISOString()
          })
        }
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
    
    // Restore product quantities using atomic operations
    const updatedProducts = []
    for (const item of order.items) {
      // Use atomic operation to restore stock
      const updateResult = await Product.findOneAndUpdate(
        { 
          _id: item.product,
          storeId: customerAuth.store._id
        },
        { 
          $inc: { 
            quantity: item.quantity // Restore the stock that was deducted
          }
        },
        { new: true }
      )
      
      if (!updateResult) {
        console.error(`Failed to restore stock for product ${item.product} during order deletion`)
      } else {
        updatedProducts.push(updateResult)
      }
    }
    
    // Broadcast inventory updates via WebSocket
    if ((global as any).io && updatedProducts.length > 0) {
      console.log('🔊 Broadcasting stock restoration via WebSocket for', updatedProducts.length, 'products')
      for (const product of updatedProducts) {
        (global as any).io.to(`store-${String(customerAuth.store._id)}`).emit('inventory-changed', {
          productId: String(product._id),
          quantity: product.quantity,
          timestamp: new Date().toISOString()
        })
        console.log(`📡 Broadcasted stock update for ${product.name}: Quantity=${product.quantity}`)
      }
    } else {
      console.log('❌ WebSocket not available or no products to broadcast')
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
