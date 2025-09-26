import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Preorder from '@/models/Preorder'
import Product from '@/models/Product'
import Store from '@/models/Store'
import mongoose from 'mongoose'

// POST /api/preorders/public - Create new preorder from public interface
export async function POST(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const body = await request.json()
    const { storeId, customerName, customerPhone, customerEmail, items, notes } = body
    
    // Validation
    if (!storeId || !customerName || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { message: 'Store ID, customer name, and items are required' },
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
    
    // Validate and calculate total
    let totalAmount = 0
    const validatedItems = []
    
    for (const item of items) {
      const product = await Product.findOne({
        _id: item.productId,
        storeId: storeId
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
      
      // Check if there's enough quantity available for preorder
      if (product.quantity < item.quantity) {
        return NextResponse.json(
          { message: `Insufficient quantity for ${product.name}. Available: ${product.quantity}, Requested: ${item.quantity}` },
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
    
    // Create the preorder - quantities are already reserved via the reservation API
    const preorder = new Preorder({
      customerName,
      customerPhone,
      customerEmail,
      items: validatedItems,
      totalAmount,
      notes,
      storeId: storeId
    })
    
    const savedPreorder = await preorder.save()
    
    // console.log(`Preorder created successfully: ${savedPreorder._id}. Quantities were already reserved via reservation API.`)
    
    if (!savedPreorder) {
      throw new Error('Failed to save preorder')
    }
    
    return NextResponse.json({
      message: 'Preorder created successfully',
      preorderId: savedPreorder._id,
      totalAmount: savedPreorder.totalAmount
    }, { status: 201 })
  } catch (error: any) {
    console.error('Error creating public preorder:', error)
    return NextResponse.json(
      { message: 'Error creating preorder', error: error.message },
      { status: 500 }
    )
  }
}
