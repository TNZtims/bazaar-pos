import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import Cart from '@/models/Cart'
import { authenticateRequest } from '@/lib/auth'

// GET /api/sales - Get all sales with pagination and filters
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
    const search = searchParams.get('search') // Customer name search
    const sort = searchParams.get('sort') || '-createdAt' // Sort order
    
    const query: any = {
      storeId: authContext.store._id
    }
    
    // Date filters
    if (date) {
      // Filter by specific date
      const startOfDay = new Date(date)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(date)
      endOfDay.setHours(23, 59, 59, 999)
      
      query.createdAt = {
        $gte: startOfDay,
        $lte: endOfDay
      }
    } else if (startDate || endDate) {
      // Date range filter
      query.createdAt = {}
      if (startDate) query.createdAt.$gte = new Date(startDate)
      if (endDate) query.createdAt.$lte = new Date(endDate)
    }
    
    // Payment method filter
    if (paymentMethod && paymentMethod !== 'all') {
      query.paymentMethod = paymentMethod
    }

    // Payment status filter
    if (paymentStatus && paymentStatus !== 'all') {
      if (paymentStatus === 'overdue') {
        // Special handling for overdue orders
        query.paymentStatus = { $in: ['pending', 'partial'] }
        query.dueDate = { $lt: new Date() }
      } else {
        query.paymentStatus = paymentStatus
      }
    }
    
    // Customer name or Order ID search
    if (search) {
      // Try to search by Order ID first (if it looks like a MongoDB ObjectId)
      if (search.length === 24 && /^[0-9a-fA-F]{24}$/.test(search)) {
        query._id = search
      } else {
        // Search by customer name, phone, or partial order ID
        query.$or = [
          { customerName: { $regex: search, $options: 'i' } },
          { customerPhone: { $regex: search, $options: 'i' } },
          { customerEmail: { $regex: search, $options: 'i' } },
          { _id: { $regex: search, $options: 'i' } } // Partial ID search
        ]
      }
    }
    
    // Sort options
    let sortOption: any = { createdAt: -1 } // Default newest first
    if (sort === 'createdAt') {
      sortOption = { createdAt: 1 } // Oldest first
    } else if (sort === '-createdAt') {
      sortOption = { createdAt: -1 } // Newest first
    }
    
    const sales = await Sale.find(query)
      .populate('items.product', 'name')
      .limit(limit)
      .skip((page - 1) * limit)
      .sort(sortOption)
    
    const total = await Sale.countDocuments(query)
    
    return NextResponse.json({
      sales,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error fetching sales', error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/sales - Create new sale
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
      tax = 0, 
      discount = 0, 
      paymentMethod = 'cash', 
      paymentStatus = 'paid',
      amountPaid = 0,
      dueDate,
      customerName, 
      customerPhone,
      customerEmail,
      notes,
      cashier 
    } = body
    
    if (!items || items.length === 0) {
      return NextResponse.json(
        { message: 'Items are required' },
        { status: 400 }
      )
    }
    
    // Validate and prepare sale items
    const saleItems: any[] = []
    let totalAmount = 0
    
    for (const item of items) {
      const product = await Product.findOne({ 
        _id: item.productId, 
        storeId: authContext.store._id 
      })
      
      if (!product) {
        return NextResponse.json(
          { message: `Product not found: ${item.productId}` },
          { status: 404 }
        )
      }
      
      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { 
            message: `Insufficient stock for ${product.name}. Available: ${product.quantity}` 
          },
          { status: 400 }
        )
      }
      
      const itemTotal = product.price * item.quantity
      totalAmount += itemTotal
      
      saleItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal
      })
    }
    
    const finalAmount = totalAmount + tax - discount
    
    // Calculate payment details
    const calculatedAmountPaid = paymentStatus === 'paid' ? finalAmount : amountPaid
    const calculatedAmountDue = finalAmount - calculatedAmountPaid
    
    // Create initial payment record if amount was paid
    const payments: any[] = []
    if (calculatedAmountPaid > 0) {
      payments.push({
        amount: calculatedAmountPaid,
        method: paymentMethod,
        date: new Date(),
        notes: paymentStatus === 'paid' ? 'Full payment' : 'Partial payment'
      })
    }
    
    // Determine final payment method
    let finalPaymentMethod = paymentMethod
    if (paymentStatus === 'pending') {
      finalPaymentMethod = 'mixed' // Will be updated when payments are made
    }
    
    // Try to use MongoDB transaction for data consistency (works with replica sets/Atlas)
    // Fall back to regular operations for standalone MongoDB
    let savedSale
    let useTransaction = true
    
    try {
      const session = await Sale.db.startSession()
      
      try {
        await session.withTransaction(async () => {
          // Create sale
          const sale = new Sale({
            items: saleItems,
            totalAmount,
            subtotal: totalAmount,
            tax,
            discount,
            finalAmount,
            paymentStatus,
            paymentMethod: finalPaymentMethod,
            amountPaid: calculatedAmountPaid,
            amountDue: calculatedAmountDue,
            payments,
            dueDate: dueDate ? new Date(dueDate) : undefined,
            customerName,
            customerPhone,
            customerEmail,
            notes,
            cashier,
            status: paymentStatus === 'paid' ? 'completed' : 'pending',
            approvalStatus: paymentStatus === 'paid' ? 'approved' : 'pending',
            approvedBy: paymentStatus === 'paid' ? 'Admin' : undefined,
            approvedAt: paymentStatus === 'paid' ? new Date() : undefined,
            storeId: authContext.store._id,
            createdBy: authContext.store._id
          })
          
          savedSale = await sale.save({ session })
          
          // Update product quantities with proper reservation handling
          for (const item of items) {
            // For admin sales, items might have been reserved through cart or might be direct sales
            // We need to handle both cases atomically
            
            // Reduce stock (simplified schema)
            const updateResult = await Product.findOneAndUpdate(
              { 
                _id: item.productId, 
                storeId: authContext.store._id,
                quantity: { $gte: item.quantity } // Ensure we have enough stock
              },
              { 
                $inc: { quantity: -item.quantity } // Reduce stock
              },
              { session, new: true }
            )
            
            if (!updateResult) {
              throw new Error(`Insufficient stock for product ${item.productId}. Required: ${item.quantity}`)
            }
            
            // Double-check that we didn't go below zero
            if (updateResult.totalQuantity < 0) {
              throw new Error(`Product ${updateResult.name} would have negative stock after sale`)
            }
          }
        })
        
        await session.endSession()
        
      } catch (transactionError: any) {
        await session.endSession()
        
        // Check if it's a transaction support error
        if (transactionError.code === 20 || transactionError.message.includes('replica set')) {
          // console.log('⚠️ Transactions not supported, falling back to regular operations')
          useTransaction = false
        } else {
          throw transactionError
        }
      }
    } catch (sessionError: any) {
      // console.log('⚠️ Session creation failed, falling back to regular operations')
      useTransaction = false
    }
    
    // Fallback to regular operations if transactions are not supported
    if (!useTransaction) {
      // Create sale without transaction
      const sale = new Sale({
        items: saleItems,
        totalAmount,
        subtotal: totalAmount,
        tax,
        discount,
        finalAmount,
        paymentStatus,
        paymentMethod: finalPaymentMethod,
        amountPaid: calculatedAmountPaid,
        amountDue: calculatedAmountDue,
        payments,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        customerName,
        customerPhone,
        customerEmail,
        notes,
        cashier,
        status: paymentStatus === 'paid' ? 'completed' : 'pending',
        approvalStatus: paymentStatus === 'paid' ? 'approved' : 'pending',
        approvedBy: paymentStatus === 'paid' ? 'Admin' : undefined,
        approvedAt: paymentStatus === 'paid' ? new Date() : undefined,
        storeId: authContext.store._id,
        createdBy: authContext.store._id
      })
      
      savedSale = await sale.save()
      
      // Update product quantities with proper reservation handling (without transaction)
      for (const item of items) {
        // Handle both reserved and direct sales atomically
        const updateResult = await Product.findOneAndUpdate(
          { 
            _id: item.productId, 
            storeId: authContext.store._id,
            totalQuantity: { $gte: item.quantity } // Ensure we have enough total stock
          },
          [
            {
              $set: {
                // Calculate how much reserved stock to release (min of requested quantity and current reserved)
                reservedToRelease: { $min: ['$reservedQuantity', item.quantity] },
                totalQuantity: { $subtract: ['$totalQuantity', item.quantity] }
              }
            },
            {
              $set: {
                reservedQuantity: { $subtract: ['$reservedQuantity', '$reservedToRelease'] }
              }
            },
            {
              $unset: 'reservedToRelease' // Clean up temporary field
            }
          ],
          { new: true }
        )
        
        // Double-check that we didn't go below zero
        if (updateResult && updateResult.totalQuantity < 0) {
          console.warn(`⚠️ Warning: Product ${updateResult.name} has negative stock: ${updateResult.totalQuantity}`)
          // Note: In production, you might want to implement stock reservation or rollback
        }
      }
      
    }
    
    // Broadcast inventory updates via WebSocket for all affected products
    if ((global as any).io) {
      for (const item of items) {
        // Fetch updated product to get current quantities
        const updatedProduct = await Product.findById(item.productId)
        if (updatedProduct) {
          (global as any).io.to(`store-${String(authContext.store._id)}`).emit('inventory-changed', {
            productId: updatedProduct._id.toString(),
            quantity: updatedProduct.quantity,
            timestamp: new Date().toISOString()
          })
        }
      }
    }
    
    // Clear user's cart after successful sale
    try {
      await Cart.findOneAndDelete({
        userId: authContext.user._id,
        storeId: authContext.store._id
      })
      // console.log('✅ Cart cleared after successful sale')
    } catch (cartError) {
      console.error('⚠️ Failed to clear cart after sale:', cartError)
      // Don't fail the sale if cart clearing fails
    }
    
    return NextResponse.json(savedSale, { status: 201 })
  } catch (error: any) {
    console.error('❌ Sale Creation Error:', error)
    
    // Handle specific MongoDB errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map((err: any) => err.message)
      return NextResponse.json(
        { 
          message: 'Validation failed', 
          error: error.message,
          validationErrors,
          debug: 'MONGOOSE_VALIDATION_ERROR'
        },
        { status: 400 }
      )
    }
    
    if (error.code === 11000) {
      return NextResponse.json(
        { 
          message: 'Duplicate key error', 
          error: error.message,
          debug: 'DUPLICATE_KEY_ERROR'
        },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { 
        message: 'Error creating sale', 
        error: error.message,
        debug: 'GENERAL_ERROR'
      },
      { status: 500 }
    )
  }
}
