import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import Store from '@/models/Store'

// POST /api/preorders/reserve - Reserve product quantities for preorder cart
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { storeId, productId, quantity, action } = body
    
    // console.log('Reservation API called:', { storeId, productId, quantity, action })
    
    // Validation
    if (!storeId || !productId || !quantity || !action) {
      return NextResponse.json(
        { message: 'Store ID, product ID, quantity, and action are required' },
        { status: 400 }
      )
    }

    if (!['reserve', 'release'].includes(action)) {
      return NextResponse.json(
        { message: 'Action must be "reserve" or "release"' },
        { status: 400 }
      )
    }
    
    // Validate store exists and is active
    const store = await Store.findById(storeId)
    if (!store || !store.isActive) {
      return NextResponse.json(
        { message: 'Store not found or inactive' },
        { status: 404 }
      )
    }
    
    // Find the product
    const product = await Product.findOne({
      _id: productId,
      storeId: storeId
    })
    
    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }
    
    if (!product.availableForPreorder) {
      return NextResponse.json(
        { message: 'Product not available for preorder' },
        { status: 400 }
      )
    }
    
    // For reserve action, get the absolute latest product data to avoid race conditions
    let currentProduct = product
    if (action === 'reserve') {
      // console.log('🔄 Fetching latest product data to avoid race conditions...')
      const latestProduct = await Product.findById(productId)
      if (!latestProduct) {
        return NextResponse.json(
          { message: 'Product not found during final validation' },
          { status: 404 }
        )
      }
      currentProduct = latestProduct
    }
    
    // Calculate the quantity change
    const quantityChange = action === 'reserve' ? -quantity : quantity
    
    // Check if we have enough quantity for reservation using the latest data
    // console.log('🔍 Stock validation in API:', {
    //   productName: currentProduct.name,
    //   action,
    //   currentQuantity: currentProduct.quantity,
    //   requestedQuantity: quantity,
    //   hasEnoughStock: currentProduct.quantity >= quantity
    // })
    
    if (action === 'reserve' && currentProduct.quantity < quantity) {
      console.error('❌ Insufficient stock detected:', {
        productName: currentProduct.name,
        available: currentProduct.quantity,
        availableType: typeof currentProduct.quantity,
        requested: quantity,
        requestedType: typeof quantity,
        shortfall: quantity - currentProduct.quantity,
        comparison: `${currentProduct.quantity} < ${quantity}`,
        comparisonResult: currentProduct.quantity < quantity
      })
      return NextResponse.json(
        { message: `Insufficient quantity. Available: ${currentProduct.quantity}, Requested: ${quantity}` },
        { status: 400 }
      )
    }
    
    // console.log('✅ Stock validation passed:', {
    //   productName: currentProduct.name,
    //   available: currentProduct.quantity,
    //   requested: quantity,
    //   willProceedWithReservation: true
    // })
    
    // Update the product quantity
    // console.log('Updating product quantity. Current:', currentProduct.quantity, 'Change:', quantityChange)
    
    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { 
        $inc: { quantity: quantityChange }
      },
      { new: true }
    )
    
    if (!updatedProduct) {
      return NextResponse.json(
        { message: 'Failed to update product quantity' },
        { status: 500 }
      )
    }
    
    // console.log('Product updated successfully. New quantity:', updatedProduct.quantity)
    
    // Broadcast the inventory change via WebSocket
    if ((global as any).io && updatedProduct) {
      (global as any).io.to(`store-${storeId}`).emit('inventory-changed', {
        productId,
        quantity: updatedProduct.quantity,
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({
      message: `Product quantity ${action}d successfully`,
      productId,
      newQuantity: updatedProduct?.quantity || 0,
      quantityChanged: Math.abs(quantityChange)
    }, { status: 200 })
    
  } catch (error: any) {
    console.error('Error reserving product quantity:', error)
    return NextResponse.json(
      { message: 'Error processing reservation', error: error.message },
      { status: 500 }
    )
  }
}
