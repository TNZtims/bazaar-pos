import { NextRequest, NextResponse } from 'next/server'
import { authenticateCustomerRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const customerAuth = await authenticateCustomerRequest(request)
    
    if (!customerAuth) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    return NextResponse.json({
      user: {
        id: customerAuth.user._id,
        customId: customerAuth.user.customId,
        name: customerAuth.user.name
      },
      store: {
        id: customerAuth.store._id,
        name: customerAuth.store.storeName
      }
    })
  } catch (error: unknown) {
    console.error('Customer auth check error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
