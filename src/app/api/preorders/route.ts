import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Preorder from '@/models/Preorder'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// GET /api/preorders - Get all preorders with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const date = searchParams.get('date') // Single date filter
    const paymentMethod = searchParams.get('paymentMethod')
    const paymentStatus = searchParams.get('paymentStatus')
    const status = searchParams.get('status')
    const approvalStatus = searchParams.get('approvalStatus')
    const search = searchParams.get('search') // Customer name search
    const sort = searchParams.get('sort') || '-createdAt' // Sort order
    
    const query: any = {
      storeId: authContext.store._id
    }
    
    // Date filtering
    if (date) {
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      query.createdAt = { $gte: startOfDay, $lte: endOfDay }
    } else if (startDate || endDate) {
      query.createdAt = {}
      if (startDate) {
        query.createdAt.$gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query.createdAt.$lte = end
      }
    }
    
    // Filter by payment method
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod
    }
    
    // Filter by payment status
    if (paymentStatus && paymentStatus !== 'all') {
      query.paymentStatus = paymentStatus
    }
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status
    }
    
    // Filter by approval status
    if (approvalStatus && approvalStatus !== 'all') {
      query.approvalStatus = approvalStatus
    }
    
    // Search by customer name, phone, or email
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerPhone: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } }
      ]
    }
    
    const skip = (page - 1) * limit
    
    const [preorders, total] = await Promise.all([
      Preorder.find(query)
        .populate('items.product', 'name imageUrl')
        .sort(sort)
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
    console.error('Error fetching preorders:', error)
    return NextResponse.json(
      { message: 'Error fetching preorders', error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/preorders - Create new preorder
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
    const { 
      items, 
      customerName, 
      customerPhone,
      customerEmail,
      estimatedDeliveryDate,
      notes,
      cashier 
    } = body
    
    if (!items || items.length === 0) {
      return NextResponse.json(
        { message: 'Items are required' },
        { status: 400 }
      )
    }
    
    // Validate and prepare preorder items (no stock checking for preorders)
    const preorderItems: any[] = []
    let totalAmount = 0
    
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity <= 0) {
        return NextResponse.json(
          { message: 'Each item must have a valid productId and quantity > 0' },
          { status: 400 }
        )
      }
      
      // Get product details
      const product = await Product.findOne({ 
        _id: item.productId, 
        storeId: authContext.store._id,
        availableForPreorder: true // Only allow preordering for products marked as available for preorder
      })
      
      if (!product) {
        return NextResponse.json(
          { message: `Product not found or not available for preorder: ${item.productId}` },
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
      customerName,
      customerPhone,
      customerEmail,
      estimatedDeliveryDate: estimatedDeliveryDate ? new Date(estimatedDeliveryDate) : undefined,
      notes: notes || '',
      status: 'pending',
      approvalStatus: 'pending',
      paymentStatus: 'pending',
      amountPaid: 0,
      amountDue: totalAmount,
      payments: [],
      cashier,
      storeId: authContext.store._id,
      createdBy: authContext.store._id
    })
    
    const savedPreorder = await preorder.save()
    
    // Broadcast preorder update via WebSocket
    if (global.io) {
      global.io.to(`store-${String(authContext.store._id)}`).emit('preorder-created', {
        preorderId: savedPreorder._id,
        customerName: savedPreorder.customerName,
        totalAmount: savedPreorder.totalAmount,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json(savedPreorder, { status: 201 })
  } catch (error: any) {
    console.error('❌ Preorder Creation Error:', error)
    return NextResponse.json(
      { message: 'Error creating preorder', error: error.message },
      { status: 500 }
    )
  }
}
