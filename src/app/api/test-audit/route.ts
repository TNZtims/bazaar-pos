import { NextRequest, NextResponse } from 'next/server'
import { createAuditLog } from '@/lib/audit-logger'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing audit log creation...')
    
    await createAuditLog({
      productId: '507f1f77bcf86cd799439011', // Test product ID
      productName: 'Test Product',
      storeId: '507f1f77bcf86cd799439012', // Test store ID
      storeName: 'Test Store',
      action: 'adjustment',
      quantityChange: -5,
      previousQuantity: 10,
      newQuantity: 5,
      reason: 'Test audit log creation',
      customerName: 'Test Customer',
      cashier: 'Test Cashier',
      userId: '507f1f77bcf86cd799439013', // Test user ID
      metadata: {
        orderType: 'sale',
        notes: 'This is a test audit log'
      }
    })
    
    return NextResponse.json({ message: 'Test audit log created successfully' })
  } catch (error: any) {
    console.error('❌ Test audit log creation failed:', error)
    return NextResponse.json(
      { message: 'Test audit log creation failed', error: error.message },
      { status: 500 }
    )
  }
}
