import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Sale from '@/models/Sale'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// GET /api/sales/[id] - Get sale by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectToDatabase()
    
    const { id } = await params
    const sale = await Sale.findById(id).populate('items.product', 'name')
    
    if (!sale) {
      return NextResponse.json(
        { message: 'Sale not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(sale)
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error fetching sale', error: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/sales/[id] - Update sale
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { action, ...updateData } = body
    
    const { id } = await params
    const sale = await Sale.findById(id)
    if (!sale) {
      return NextResponse.json(
        { message: 'Sale not found' },
        { status: 404 }
      )
    }

    console.log(`🔄 Updating sale ${id} with action: ${action}`)
    
    if (action === 'add_payment') {
      return await handleAddPayment(sale, updateData, authContext)
    } else if (action === 'update_items') {
      return await handleUpdateItems(sale, updateData)
    } else if (action === 'update_order_details') {
      return await handleUpdateOrderDetails(sale, updateData)
    } else if (action === 'cancel') {
      return await handleCancelSale(sale)
    } else if (action === 'reactivate') {
      return await handleReactivateSale(sale)
    } else {
      return await handleGeneralUpdate(sale, updateData)
    }
    
  } catch (error: any) {
    console.error('❌ Error updating sale:', error)
    return NextResponse.json(
      { message: 'Error updating sale', error: error.message },
      { status: 500 }
    )
  }
}

// Handle adding payment to existing sale
async function handleAddPayment(sale: any, paymentData: any, authContext: any) {
  const { amount, method, notes, cashier } = paymentData
  const finalCashier = cashier || authContext.selectedCashier
  
  console.log(`💳 Adding payment to sale ${sale._id}:`, { amount, method, notes, cashier, finalCashier })
  
  if (!amount || amount <= 0) {
    return NextResponse.json(
      { message: 'Payment amount must be greater than 0' },
      { status: 400 }
    )
  }
  
  if (amount > sale.amountDue) {
    return NextResponse.json(
      { message: 'Payment amount cannot exceed amount due' },
      { status: 400 }
    )
  }
  
  // Add payment
  sale.payments.push({
    amount,
    method,
    date: new Date(),
    notes,
    cashier: finalCashier
  })
  
  // Update payment status
  sale.amountPaid += amount
  sale.amountDue -= amount
  
  // Update cashier field if provided
  if (finalCashier) {
    sale.cashier = finalCashier
  }
  
  if (sale.amountDue <= 0) {
    sale.paymentStatus = 'paid'
    const wasCompleted = sale.status === 'completed'
    sale.status = 'completed'
    
    // Mark order as approved when fully paid (quantities already deducted)
    if (!wasCompleted && sale.approvalStatus === 'pending') {
      sale.approvalStatus = 'approved'
      // Note: Quantities were already deducted when order was created
    }
  } else {
    sale.paymentStatus = 'partial'
  }
  
  // Update payment method if mixed
  const paymentMethods = [...new Set(sale.payments.map((p: any) => p.method))]
  if (paymentMethods.length > 1) {
    sale.paymentMethod = 'mixed'
  }
  
  const updatedSale = await sale.save()
  return NextResponse.json(updatedSale)
}

// Handle updating sale items
async function handleUpdateItems(sale: any, updateData: any) {
  const { items, tax, discount, customerName, customerPhone, customerEmail, notes, dueDate } = updateData
  
  if (sale.status === 'completed' || sale.status === 'cancelled') {
    return NextResponse.json(
      { message: 'Cannot modify completed or cancelled sales' },
      { status: 400 }
    )
  }

  // console.log(`📝 Updating items for sale ${sale._id}`)
  // console.log(`- Original items: ${sale.items.length}`)
  // console.log(`- New items: ${items?.length || 0}`)
  
  // Use intelligent fallback for transactions (same as main sales route)
  let useTransaction = true
  let updatedSale
  
  try {
    const session = await Sale.db.startSession()
    
    try {
      await session.withTransaction(async () => {
        // Restore original product quantities
        for (const item of sale.items) {
          await Product.findByIdAndUpdate(
            item.product,
            { $inc: { quantity: item.quantity } },
            { session }
          )
        }
        
        // Validate and prepare new items
        const saleItems = []
        let totalAmount = 0
        
        for (const item of items) {
          const product = await Product.findById(item.productId).session(session)
          
          if (!product) {
            throw new Error(`Product not found: ${item.productId}`)
          }
          
          if (product.quantity < item.quantity) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${product.quantity}`)
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
        
        const newFinalAmount = totalAmount + (tax ?? sale.tax) - (discount ?? sale.discount)
        
        // Update sale
        sale.items = saleItems
        sale.totalAmount = totalAmount
        sale.subtotal = totalAmount
        if (tax !== undefined) sale.tax = tax
        if (discount !== undefined) sale.discount = discount
        sale.finalAmount = newFinalAmount
        
        // Update customer details if provided
        if (customerName !== undefined) sale.customerName = customerName
        if (customerPhone !== undefined) sale.customerPhone = customerPhone
        if (customerEmail !== undefined) sale.customerEmail = customerEmail
        if (notes !== undefined) sale.notes = notes
        if (dueDate !== undefined) sale.dueDate = dueDate ? new Date(dueDate) : null
        
        // Add modification history
        if (!sale.modificationHistory) sale.modificationHistory = []
        sale.modificationHistory.push({
          action: 'update_items',
          timestamp: new Date(),
          changes: `Updated items: ${items.length} products, Tax: ₱${tax ?? sale.tax}, Discount: ₱${discount ?? sale.discount}`
        })
        
        // Recalculate payment status
        if (sale.amountPaid >= newFinalAmount) {
          sale.paymentStatus = 'paid'
          sale.amountDue = 0
          sale.status = 'completed'
        } else if (sale.amountPaid > 0) {
          sale.paymentStatus = 'partial'
          sale.amountDue = newFinalAmount - sale.amountPaid
        } else {
          sale.paymentStatus = 'pending'
          sale.amountDue = newFinalAmount
        }
        
        updatedSale = await sale.save({ session })
        
        // Update new product quantities
        for (const item of items) {
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { quantity: -item.quantity } },
            { session }
          )
        }
      })
      
      await session.endSession()
      // console.log('✅ Sale items updated with transaction')
      
    } catch (transactionError: any) {
      await session.endSession()
      
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
    // Restore original product quantities
    for (const item of sale.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { quantity: item.quantity } }
      )
    }
    
    // Validate and prepare new items
    const saleItems = []
    let totalAmount = 0
    
    for (const item of items) {
      const product = await Product.findById(item.productId)
      
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
    
    const newFinalAmount = totalAmount + (tax ?? sale.tax) - (discount ?? sale.discount)
    
    // Update sale
    sale.items = saleItems
    sale.totalAmount = totalAmount
    sale.subtotal = totalAmount
    if (tax !== undefined) sale.tax = tax
    if (discount !== undefined) sale.discount = discount
    sale.finalAmount = newFinalAmount
    
    // Update customer details if provided
    if (customerName !== undefined) sale.customerName = customerName
    if (customerPhone !== undefined) sale.customerPhone = customerPhone
    if (customerEmail !== undefined) sale.customerEmail = customerEmail
    if (notes !== undefined) sale.notes = notes
    if (dueDate !== undefined) sale.dueDate = dueDate ? new Date(dueDate) : null
    
    // Add modification history
    if (!sale.modificationHistory) sale.modificationHistory = []
    sale.modificationHistory.push({
      action: 'update_items',
      timestamp: new Date(),
      changes: `Updated items: ${items.length} products, Tax: ₱${tax ?? sale.tax}, Discount: ₱${discount ?? sale.discount}`
    })
    
    // Recalculate payment status
    if (sale.amountPaid >= newFinalAmount) {
      sale.paymentStatus = 'paid'
      sale.amountDue = 0
      sale.status = 'completed'
    } else if (sale.amountPaid > 0) {
      sale.paymentStatus = 'partial'
      sale.amountDue = newFinalAmount - sale.amountPaid
    } else {
      sale.paymentStatus = 'pending'
      sale.amountDue = newFinalAmount
    }
    
    updatedSale = await sale.save()
    
    // Update new product quantities
    for (const item of items) {
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { quantity: -item.quantity } }
      )
    }
    
    // console.log('✅ Sale items updated without transaction')
  }
  
  return NextResponse.json(updatedSale)
}

// Handle cancelling sale
async function handleCancelSale(sale: any) {
  if (sale.status === 'cancelled') {
    return NextResponse.json(
      { message: 'Sale is already cancelled' },
      { status: 400 }
    )
  }
  
  // Restore product quantities (since all orders immediately reduce quantities)
  for (const item of sale.items) {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { totalQuantity: item.quantity } }
    )
  }
  
  sale.status = 'cancelled'
  const updatedSale = await sale.save()
  
  return NextResponse.json(updatedSale)
}

// Handle updating order details only (customer info, notes, tax, discount)
async function handleUpdateOrderDetails(sale: any, updateData: any) {
  const { customerName, customerPhone, customerEmail, notes, dueDate, tax, discount } = updateData
  
  if (sale.status === 'cancelled') {
    return NextResponse.json(
      { message: 'Cannot modify cancelled orders' },
      { status: 400 }
    )
  }

  // console.log(`📝 Updating order details for sale ${sale._id}`)
  
  // Update customer details
  if (customerName !== undefined) sale.customerName = customerName
  if (customerPhone !== undefined) sale.customerPhone = customerPhone
  if (customerEmail !== undefined) sale.customerEmail = customerEmail
  if (notes !== undefined) sale.notes = notes
  if (dueDate !== undefined) sale.dueDate = dueDate ? new Date(dueDate) : null
  
  // Update tax and discount if provided
  let recalculateTotal = false
  if (tax !== undefined && tax !== sale.tax) {
    sale.tax = tax
    recalculateTotal = true
  }
  if (discount !== undefined && discount !== sale.discount) {
    sale.discount = discount
    recalculateTotal = true
  }
  
  // Recalculate totals if tax or discount changed
  if (recalculateTotal) {
    const newFinalAmount = sale.subtotal + sale.tax - sale.discount
    sale.finalAmount = newFinalAmount
    
    // Recalculate payment status
    if (sale.amountPaid >= newFinalAmount) {
      sale.paymentStatus = 'paid'
      sale.amountDue = 0
      sale.status = 'completed'
    } else if (sale.amountPaid > 0) {
      sale.paymentStatus = 'partial'
      sale.amountDue = newFinalAmount - sale.amountPaid
    } else {
      sale.paymentStatus = 'pending'
      sale.amountDue = newFinalAmount
    }
    
    // console.log(`💰 Recalculated total: ₱${newFinalAmount}`)
  }
  
  // Add modification history
  if (!sale.modificationHistory) sale.modificationHistory = []
  const changes = []
  if (customerName !== undefined) changes.push('customer info')
  if (tax !== undefined) changes.push(`tax: ₱${tax}`)
  if (discount !== undefined) changes.push(`discount: ₱${discount}`)
  if (dueDate !== undefined) changes.push('due date')
  if (notes !== undefined) changes.push('notes')
  
  sale.modificationHistory.push({
    action: 'update_details',
    timestamp: new Date(),
    changes: `Updated: ${changes.join(', ')}`
  })
  
  const updatedSale = await sale.save()
  // console.log('✅ Order details updated successfully')
  return NextResponse.json(updatedSale)
}

// Handle reactivating cancelled sale
async function handleReactivateSale(sale: any) {
  if (sale.status !== 'cancelled') {
    return NextResponse.json(
      { message: 'Only cancelled sales can be reactivated' },
      { status: 400 }
    )
  }

  // console.log(`🔄 Reactivating sale ${sale._id}`)
  
  // Check if products are still available
  for (const item of sale.items) {
    const product = await Product.findById(item.product)
    
    if (!product) {
      return NextResponse.json(
        { message: `Product ${item.productName} is no longer available` },
        { status: 400 }
      )
    }
    
    if (product.quantity < item.quantity) {
      return NextResponse.json(
        { 
          message: `Insufficient stock for ${product.name}. Available: ${product.quantity}, Required: ${item.quantity}` 
        },
        { status: 400 }
      )
    }
  }
  
  // Reactivate sale and update inventory
  sale.status = sale.paymentStatus === 'paid' ? 'completed' : 'active'
  
  // Update product quantities
  for (const item of sale.items) {
    await Product.findByIdAndUpdate(
      item.product,
      { $inc: { quantity: -item.quantity } }
    )
  }
  
  const updatedSale = await sale.save()
  // console.log('✅ Sale reactivated successfully')
  return NextResponse.json(updatedSale)
}

// Handle general sale updates (customer info, notes, etc.)
async function handleGeneralUpdate(sale: any, updateData: any) {
  const allowedFields = ['customerName', 'customerPhone', 'customerEmail', 'notes', 'dueDate']
  
  for (const field of allowedFields) {
    if (updateData[field] !== undefined) {
      if (field === 'dueDate' && updateData[field]) {
        sale[field] = new Date(updateData[field])
      } else {
        sale[field] = updateData[field]
      }
    }
  }
  
  const updatedSale = await sale.save()
  return NextResponse.json(updatedSale)
}

// DELETE /api/sales/[id] - Delete sale (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { id } = await params
    const sale = await Sale.findById(id)
    
    if (!sale) {
      return NextResponse.json(
        { message: 'Sale not found' },
        { status: 404 }
      )
    }
    
    // FIXED: Prevent deletion of completed orders and restrict stock restoration
    if (sale.paymentStatus === 'paid' || sale.status === 'completed') {
      return NextResponse.json(
        { message: 'Cannot delete completed or paid orders. This prevents inventory corruption.' },
        { status: 400 }
      )
    }
    
    // Additional safety check: Only allow deletion within 24 hours of creation for pending orders
    const createdAt = new Date(sale.createdAt)
    const now = new Date()
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60)
    
    if (hoursSinceCreation > 24) {
      return NextResponse.json(
        { message: 'Cannot delete orders older than 24 hours. Contact administrator if needed.' },
        { status: 400 }
      )
    }
    
    console.log(`🗑️ AUDIT: Deleting order ${id} and restoring stock for ${sale.items.length} items`)
    console.log(`🗑️ AUDIT: Order details - Customer: ${sale.customerName}, Status: ${sale.status}, Payment: ${sale.paymentStatus}, Created: ${sale.createdAt}`)
    
    // Restore product quantities (both total and reserved)
    const updatedProducts = []
    for (const item of sale.items) {
      const product = await Product.findById(item.product)
      if (product) {
        const oldQuantity = product.quantity
        console.log(`📦 AUDIT: Restoring ${item.quantity} units of ${product.name} (ID: ${item.product}) - Old Qty: ${oldQuantity}`)
        
        // Add back to quantity (the actual database field)
        const updatedProduct = await Product.findByIdAndUpdate(
          item.product,
          { 
            $inc: { 
              quantity: item.quantity  // Restore to the main quantity field
            }
          },
          { new: true }
        )
        if (updatedProduct) {
          updatedProducts.push(updatedProduct)
          console.log(`✅ AUDIT: Stock restored for ${product.name}: ${oldQuantity} → ${updatedProduct.quantity} (+${item.quantity})`)
        }
      } else {
        console.warn(`⚠️ AUDIT: Product ${item.product} not found during stock restoration`)
      }
    }
    
    // Broadcast inventory updates via WebSocket
    if ((global as any).io && updatedProducts.length > 0) {
      console.log('🔊 Broadcasting stock restoration via WebSocket for', updatedProducts.length, 'products')
      for (const product of updatedProducts) {
        (global as any).io.to(`store-${String(product.storeId)}`).emit('inventory-changed', {
          productId: String(product._id),
          quantity: product.quantity, // Use the actual database quantity field
          timestamp: new Date().toISOString()
        })
        console.log(`📡 Broadcasted stock update for ${product.name}: Quantity=${product.quantity}`)
      }
    } else {
      console.log('❌ WebSocket not available or no products to broadcast')
    }
    
    await Sale.findByIdAndDelete(id)
    
    return NextResponse.json({ message: 'Order deleted successfully' })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error deleting order', error: error.message },
      { status: 500 }
    )
  }
}
