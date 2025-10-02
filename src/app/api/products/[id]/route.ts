import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateRequest, canAccessStore } from '@/lib/auth'
import { createAuditLog } from '@/lib/audit-logger'

// GET /api/products/[id] - Get single product
export async function GET(
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
    const product = await Product.findById(id)
    
    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }
    
    // Check if store can access this product's data
    if (!canAccessStore(authContext.store, product.storeId.toString())) {
      return NextResponse.json(
        { message: 'Access denied' },
        { status: 403 }
      )
    }
    
    return NextResponse.json(product)
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error fetching product', error: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/products/[id] - Update product
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Products management page should ONLY use admin authentication
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin authentication required for product management' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const body = await request.json()
    const { name, price, discountPrice, quantity, initialStock, description, category, sku, cost, seller, imageUrl } = body
    
    console.log('🔧 API received data:', body)
    console.log('🔧 Extracted initialStock:', initialStock)
    console.log('🔧 Extracted quantity:', quantity)
    console.log('🔧 initialStock type:', typeof initialStock)
    console.log('🔧 initialStock is undefined:', initialStock === undefined)
    console.log('🔧 initialStock is null:', initialStock === null)
    
    const { id } = await params
    
    // Get current product for audit logging
    const currentProduct = await Product.findById(id)
    if (!currentProduct) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }
    
    // Build update object dynamically - only include fields that are provided
    const updateData: any = {
      name, 
      price, 
      quantity, 
      description, 
      category, 
      sku, 
      cost, 
      seller,
      imageUrl,
      availableForPreorder: true
    }

    // Handle discountPrice - set to null if empty/zero, otherwise use the value
    updateData.discountPrice = (discountPrice && parseFloat(discountPrice) > 0) ? parseFloat(discountPrice) : null
    
    // Debug logging for discount price validation
    console.log('🔍 API Debug - Raw values:', { price, discountPrice })
    console.log('🔍 API Debug - Parsed values:', { 
      price: parseFloat(price), 
      discountPrice: updateData.discountPrice 
    })
    console.log('🔍 API Debug - Validation check:', {
      hasDiscountPrice: updateData.discountPrice !== null,
      isDiscountLessThanPrice: updateData.discountPrice ? updateData.discountPrice < parseFloat(price) : 'N/A'
    })
    
    // Always include initialStock in update - it's a standalone note field
    updateData.initialStock = initialStock !== undefined ? initialStock : null
    
    // Final validation check before saving
    if (updateData.discountPrice && updateData.discountPrice >= parseFloat(price)) {
      return NextResponse.json(
        { message: `Validation failed: Discount price (${updateData.discountPrice}) must be less than regular price (${parseFloat(price)})` },
        { status: 400 }
      )
    }
    
    console.log('🔧 initialStock will be updated to:', updateData.initialStock, '(standalone note field)')
    console.log('🔧 Final update data:', updateData)
    
    console.log('🔧 Update data keys:', Object.keys(updateData))
    console.log('🔧 Update data includes initialStock:', 'initialStock' in updateData)
    
    const product = await Product.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
    
    // Create audit log for quantity changes
    if (quantity !== undefined && currentProduct.quantity !== quantity) {
      const quantityChange = quantity - currentProduct.quantity
      await createAuditLog({
        productId: id,
        productName: product.name,
        storeId: authContext.store._id.toString(),
        storeName: authContext.store.storeName,
        action: 'adjustment',
        quantityChange: quantityChange,
        previousQuantity: currentProduct.quantity,
        newQuantity: quantity,
        reason: 'Manual quantity adjustment via product edit',
        userId: authContext.user._id.toString(),
        metadata: {
          notes: `Quantity changed from ${currentProduct.quantity} to ${quantity} (${quantityChange > 0 ? '+' : ''}${quantityChange})`
        }
      })
    }
    
    // Force migration for existing products - check if initialStock field exists at all
    console.log('🔧 Checking product for migration:', {
      id: product._id,
      name: product.name,
      quantity: product.quantity,
      initialStock: product.initialStock,
      hasInitialStock: 'initialStock' in product,
      initialStockType: typeof product.initialStock
    })
    
    if (!('initialStock' in product) || product.initialStock === undefined || product.initialStock === null) {
      console.log('🔧 FORCING MIGRATION - setting initialStock to null (standalone note field)')
      product.initialStock = null  // Set to null as default - this is a standalone note field
      await product.save()
      console.log('🔧 Migration completed - product saved with initialStock:', product.initialStock)
    } else {
      console.log('🔧 No migration needed - initialStock already exists:', product.initialStock)
    }
    
    // Re-fetch the product to get the latest data after migration
    const updatedProduct = await Product.findById(id)
    console.log('🔧 Product after migration:', {
      id: updatedProduct._id,
      name: updatedProduct.name,
      quantity: updatedProduct.quantity,
      initialStock: updatedProduct.initialStock
    })
    
    // Create audit log for quantity changes
    if (quantity !== undefined && quantity !== currentProduct.quantity) {
      await createAuditLog({
        productId: id,
        productName: updatedProduct.name,
        storeId: updatedProduct.storeId.toString(),
        storeName: authContext.store.storeName,
        action: 'adjustment',
        quantityChange: quantity - currentProduct.quantity,
        previousQuantity: currentProduct.quantity,
        newQuantity: quantity,
        reason: 'Manual quantity adjustment via Edit Product modal',
        cashier: authContext.selectedCashier || 'Admin',
        userId: (authContext as any).user?._id?.toString(),
        metadata: {
          orderType: 'adjustment',
          notes: 'Product quantity updated via admin panel'
        }
      })
    }
    
    // Broadcast inventory update via WebSocket with correct values
    console.log('🔍 WebSocket Debug - global.io exists:', !!(global as any).io)
    console.log('🔍 WebSocket Debug - global.io type:', typeof (global as any).io)
    if ((global as any).io && typeof (global as any).io.to === 'function') {
      console.log('🔍 WebSocket Debug - io.to function exists')
      try {
        // Broadcast inventory change for quantity updates
        (global as any).io.to(`store-${updatedProduct.storeId}`).emit('inventory-changed', {
          productId: (updatedProduct._id as any).toString(),
          quantity: updatedProduct.quantity,
          initialStock: updatedProduct.initialStock,
          timestamp: new Date().toISOString()
        })
        console.log('📡 Broadcasted inventory-changed event')
        
        // Broadcast full product update for other changes (including discount price)
        (global as any).io.to(`store-${updatedProduct.storeId}`).emit('product-updated', {
          product: {
            _id: (updatedProduct._id as any).toString(),
            name: updatedProduct.name,
            price: updatedProduct.price,
            discountPrice: updatedProduct.discountPrice,
            cost: updatedProduct.cost,
            quantity: updatedProduct.quantity,
            initialStock: updatedProduct.initialStock,
            availableForPreorder: updatedProduct.availableForPreorder,
            description: updatedProduct.description,
            category: updatedProduct.category,
            sku: updatedProduct.sku,
            seller: updatedProduct.seller,
            imageUrl: updatedProduct.imageUrl,
            storeId: (updatedProduct.storeId as any).toString(),
            createdAt: updatedProduct.createdAt,
            updatedAt: updatedProduct.updatedAt
          },
          timestamp: new Date().toISOString()
        })
        console.log('📡 Broadcasted product-updated event with discount price:', updatedProduct.discountPrice)
      } catch (wsError) {
        console.error('❌ WebSocket broadcasting error:', wsError)
        // Don't throw the error - WebSocket issues shouldn't prevent product updates
      }
    } else {
      console.log('❌ WebSocket server not available - cannot broadcast product updates')
      console.log('🔍 WebSocket Debug - global.io:', (global as any).io)
      console.log('🔍 WebSocket Debug - global.io.to type:', typeof (global as any).io?.to)
    }
    
    return NextResponse.json(updatedProduct)
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'SKU already exists' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { message: 'Error updating product', error: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/products/[id] - Delete product
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Products management page should ONLY use admin authentication
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin authentication required for product management' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { id } = await params
    const product = await Product.findByIdAndDelete(id)
    
    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }
    
    // Broadcast product deletion via WebSocket
    if ((global as any).io) {
      (global as any).io.to(`store-${product.storeId}`).emit('product-deleted', {
        productId: (product._id as any).toString(),
        timestamp: new Date().toISOString()
      })
    }
    
    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error deleting product', error: error.message },
      { status: 500 }
    )
  }
}
