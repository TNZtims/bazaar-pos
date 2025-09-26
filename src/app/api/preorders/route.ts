import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Preorder from '@/models/Preorder'
import Product from '@/models/Product'
import { authenticateRequest } from '@/lib/auth'

// GET /api/preorders - Get all preorders for the store
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
    const status = searchParams.get('status')
    const approvalStatus = searchParams.get('approvalStatus')
    
    const query: any = { storeId: authContext.store._id }
    
    if (status) {
      query.status = status
    }
    
    if (approvalStatus) {
      query.approvalStatus = approvalStatus
    }
    
    const preorders = await Preorder.find(query)
      .populate('items.product', 'name price imageUrl')
      .sort({ createdAt: -1 })
    
    return NextResponse.json(preorders)
  } catch (error: any) {
    console.error('Error fetching preorders:', error)
    return NextResponse.json(
      { message: 'Error fetching preorders', error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/preorders - Create new preorder (admin only)
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
    const { customerName, customerPhone, customerEmail, items, notes } = body
    
    // Validation
    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: 'Customer name and items are required' },
        { status: 400 }
      )
    }
    
    // Validate and calculate total
    let totalAmount = 0
    const validatedItems = []
    
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
      
      if (!product.availableForPreorder) {
        return NextResponse.json(
          { message: `Product not available for preorder: ${product.name}` },
          { status: 400 }
        )
      }
      
      const validatedItem = {
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price
      }
      
      validatedItems.push(validatedItem)
      totalAmount += validatedItem.quantity * validatedItem.unitPrice
    }
    
    const preorder = new Preorder({
      customerName,
      customerPhone,
      customerEmail,
      items: validatedItems,
      totalAmount,
      notes,
      storeId: authContext.store._id
    })
    
    const savedPreorder = await preorder.save()
    
    return NextResponse.json(savedPreorder, { status: 201 })
  } catch (error: any) {
    console.error('Error creating preorder:', error)
    return NextResponse.json(
      { message: 'Error creating preorder', error: error.message },
      { status: 500 }
    )
  }
}
