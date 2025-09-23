import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'
import { authenticateRequest, canAccessStore } from '@/lib/auth'

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
    await connectToDatabase()
    
    const body = await request.json()
    const { name, price, quantity, totalQuantity, description, category, sku, cost, seller, imageUrl } = body
    
    // Use totalQuantity if provided, otherwise fall back to quantity for backward compatibility
    const finalQuantity = totalQuantity !== undefined ? totalQuantity : quantity
    
    const { id } = await params
    const product = await Product.findByIdAndUpdate(
      id,
      { 
        name, 
        price, 
        totalQuantity: finalQuantity, 
        description, 
        category, 
        sku, 
        cost, 
        seller,
        imageUrl 
      },
      { new: true, runValidators: true }
    )
    
    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(product)
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
    await connectToDatabase()
    
    const { id } = await params
    const product = await Product.findByIdAndDelete(id)
    
    if (!product) {
      return NextResponse.json(
        { message: 'Product not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({ message: 'Product deleted successfully' })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error deleting product', error: error.message },
      { status: 500 }
    )
  }
}
