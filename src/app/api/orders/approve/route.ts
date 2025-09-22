import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// POST /api/orders/approve - Approve or reject customer orders (admin only)
export async function POST(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin authentication required' },
        { status: 403 }
      )
    }
    
    await connectToDatabase()
    
    const body = await request.json()
    const { orderId, action, cashier, paymentStatus, paymentMethod, amountPaid, notes } = body
    
    // Validation
    if (!orderId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { message: 'Order ID and valid action (approve/reject) are required' },
        { status: 400 }
      )
    }
    
    // Find the order
    const order = await Sale.findOne({
      _id: orderId,
      storeId: authContext.store._id,
      approvalStatus: 'pending'
    })
    
    if (!order) {
      return NextResponse.json(
        { message: 'Order not found or already processed' },
        { status: 404 }
      )
    }
    
    if (action === 'reject') {
      // Reject the order
      order.approvalStatus = 'rejected'
      order.status = 'cancelled'
      order.approvedBy = cashier || 'Admin'
      order.approvedAt = new Date()
      
      if (notes) {
        order.notes = order.notes ? `${order.notes}\n\nRejection reason: ${notes}` : `Rejection reason: ${notes}`
      }
      
      await order.save()
      
      return NextResponse.json({
        message: 'Order rejected successfully',
        order: {
          id: order._id,
          status: order.status,
          approvalStatus: order.approvalStatus,
          approvedBy: order.approvedBy,
          approvedAt: order.approvedAt
        }
      })
    }
    
    if (action === 'approve') {
      // Validate required fields for approval
      if (!cashier) {
        return NextResponse.json(
          { message: 'Cashier name is required for approval' },
          { status: 400 }
        )
      }
      
      // Check stock availability (in case stock changed)
      for (const item of order.items) {
        const product = await Product.findById(item.product)
        if (!product) {
          return NextResponse.json(
            { message: `Product no longer exists: ${item.productName}` },
            { status: 400 }
          )
        }
        
        if (product.quantity < item.quantity) {
          return NextResponse.json(
            { message: `Insufficient stock for ${product.name}. Available: ${product.quantity}, Required: ${item.quantity}` },
            { status: 400 }
          )
        }
      }
      
      // Update inventory
      for (const item of order.items) {
        await Product.findByIdAndUpdate(
          item.product,
          { $inc: { quantity: -item.quantity } }
        )
      }
      
      // Update order status
      order.approvalStatus = 'approved'
      order.status = paymentStatus || 'approved'
      order.approvedBy = cashier
      order.cashier = cashier
      order.approvedAt = new Date()
      
      if (paymentStatus) {
        order.paymentStatus = paymentStatus
      }
      
      if (paymentMethod) {
        order.paymentMethod = paymentMethod
      }
      
      if (amountPaid !== undefined) {
        order.amountPaid = amountPaid
        order.amountDue = order.finalAmount - amountPaid
        
        // Add payment record
        if (amountPaid > 0) {
          order.payments.push({
            amount: amountPaid,
            method: paymentMethod || 'cash',
            date: new Date(),
            notes: 'Initial payment on approval'
          })
        }
      }
      
      if (notes) {
        order.notes = order.notes ? `${order.notes}\n\nApproval notes: ${notes}` : `Approval notes: ${notes}`
      }
      
      await order.save()
      
      return NextResponse.json({
        message: 'Order approved successfully',
        order: {
          id: order._id,
          status: order.status,
          approvalStatus: order.approvalStatus,
          paymentStatus: order.paymentStatus,
          approvedBy: order.approvedBy,
          cashier: order.cashier,
          approvedAt: order.approvedAt,
          amountPaid: order.amountPaid,
          amountDue: order.amountDue
        }
      })
    }
    
  } catch (error: any) {
    console.error('Error processing order approval:', error)
    return NextResponse.json(
      { message: 'Error processing order', error: error.message },
      { status: 500 }
    )
  }
}
