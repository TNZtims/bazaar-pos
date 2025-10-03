import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit-logger'

export async function POST(request: NextRequest) {
  try {
    // Authenticate the request
    const authContext = await authenticateRequest(request)
    if (!authContext) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { store } = authContext
    const storeId = store._id.toString()

    // Connect to database
    await connectToDatabase()

    // Get all products for the store using Mongoose
    const products = await Product.find({ storeId }).lean()

    if (products.length === 0) {
      return NextResponse.json({ message: 'No products found to transfer' }, { status: 200 })
    }

    // Update all products using Mongoose
    const updatePromises = products.map(product => 
      Product.findByIdAndUpdate(
        product._id,
        {
          $set: {
            initialStock: product.quantity || 0, // Transfer current stock to initial stock
            quantity: 0, // Zero out current stock
            totalQuantity: 0, // Zero out total quantity
            availableQuantity: 0, // Zero out available quantity
            reservedQuantity: 0, // Zero out reserved quantity
            lastUpdated: new Date().toISOString()
          }
        },
        { new: true }
      )
    )

    // Execute all updates
    const results = await Promise.all(updatePromises)
    const modifiedCount = results.filter(result => result !== null).length

    // Create audit log for the stock transfer
    await createAuditLog({
      storeId,
      action: 'stock_transfer',
      details: {
        productsAffected: products.length,
        totalStockTransferred: products.reduce((sum, product) => sum + (product.quantity || 0), 0),
        operation: 'Transfer current stock to initial stock and zero out current stock'
      },
      userId: store._id.toString(),
      userRole: 'admin'
    })

    return NextResponse.json({
      message: 'Stock transfer completed successfully',
      productsAffected: modifiedCount,
      totalStockTransferred: products.reduce((sum, product) => sum + (product.quantity || 0), 0)
    })

  } catch (error) {
    console.error('Error transferring stock:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: 'Failed to transfer stock' },
      { status: 500 }
    )
  }
}
