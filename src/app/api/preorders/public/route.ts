import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Preorder from '@/models/Preorder'
import Product from '@/models/Product'
import { authenticateCustomerRequest } from '@/lib/auth'

// GET /api/preorders/public - Get customer's preorders
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
    
    if (status && status !== 'all') {
      query.status = status
    }
    
    const skip = (page - 1) * limit
    
    const [preorders, total] = await Promise.all([
      Preorder.find(query)
        .populate('items.product', 'name imageUrl')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Preorder.countDocuments(query)
    ])
    
    return NextResponse.json({
      preorders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  } catch (error: any) {
    console.error('Error fetching customer preorders:', error)
    return NextResponse.json(
      { message: 'Error fetching preorders', error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/preorders/public - Create new customer preorder
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
    const { items, estimatedDeliveryDate, notes } = body
    
    if (!items || items.length === 0) {
      return NextResponse.json(
        { message: 'Items are required' },
        { status: 400 }
      )
    }
    
    // Validate and prepare preorder items
    const preorderItems: any[] = []
    let totalAmount = 0
    
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { message: 'Each item must have a valid productId and quantity > 0' },
          { status: 400 }
        )
      }
      
      // Get product details and verify it's available for preorder
      const product = await Product.findOne({ 
        _id: item.productId, 
        storeId: customerAuth.store._id,
        availableForPreorder: true
      })
      
      if (!product) {
        return NextResponse.json(
          { message: `Product not available for preorder: ${item.productId}` },
          { status: 400 }
        )
      }
      
      const itemTotal = product.price * item.quantity
      totalAmount += itemTotal
      
      preorderItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal
      })
    }
    
    // Create preorder
    const preorder = new Preorder({
      items: preorderItems,
      totalAmount,
      customerName: customerAuth.user.name,
      customerPhone: customerAuth.user.phone,
      customerEmail: customerAuth.user.email,
      customerId: customerAuth.user._id,
      customerCustomId: customerAuth.user.customId,
      estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : undefined,
      notes: notes || '',
      status: 'pending',
      approvalStatus: 'pending',
      paymentStatus: 'pending',
      amountPaid: 0,
      amountDue: totalAmount,
      payments: [],
      storeId: customerAuth.store._id
    })
    
    const savedPreorder = await preorder.save()
    
    // Broadcast preorder update via WebSocket
    if (global.io) {
      global.io.to(`store-${String(customerAuth.store._id)}`).emit('preorder-created', {
        preorderId: savedPreorder._id,
        customerName: savedPreorder.customerName,
        totalAmount: savedPreorder.totalAmount,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({
      message: 'Preorder placed successfully. Waiting for admin approval.',
      preorder: {
        id: savedPreorder._id,
        items: savedPreorder.items,
        totalAmount: savedPreorder.totalAmount,
        status: savedPreorder.status,
        approvalStatus: savedPreorder.approvalStatus,
        estimatedDeliveryDate: savedPreorder.estimatedDeliveryDate,
        createdAt: savedPreorder.createdAt
      }
    }, { status: 201 })
    
  } catch (error: any) {
    console.error('Error creating customer preorder:', error)
    return NextResponse.json(
      { message: 'Error creating preorder', error: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/preorders/public - Delete customer's pending preorder
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
    const preorderId = searchParams.get('preorderId')
    
    if (!preorderId) {
      return NextResponse.json(
        { message: 'Preorder ID is required' },
        { status: 400 }
      )
    }
    
    // Find the preorder and verify ownership
    const preorder = await Preorder.findOne({
      _id: preorderId,
      customerId: customerAuth.user._id,
      storeId: customerAuth.store._id
    })
    
    if (!preorder) {
      return NextResponse.json(
        { message: 'Preorder not found' },
        { status: 404 }
      )
    }
    
    // Only allow deletion of pending preorders
    if (preorder.approvalStatus !== 'pending' || preorder.status !== 'pending') {
      return NextResponse.json(
        { message: 'Can only delete pending preorders' },
        { status: 400 }
      )
    }
    
    await Preorder.findByIdAndDelete(preorderId)
    
    // Broadcast preorder deletion via WebSocket
    if (global.io) {
      global.io.to(`store-${String(customerAuth.store._id)}`).emit('preorder-deleted', {
        preorderId: preorderId,
        customerName: preorder.customerName,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({ message: 'Preorder deleted successfully' })
    
  } catch (error: any) {
    console.error('Error deleting customer preorder:', error)
    return NextResponse.json(
      { message: 'Error deleting preorder', error: error.message },
      { status: 500 }
    )
  }
}
