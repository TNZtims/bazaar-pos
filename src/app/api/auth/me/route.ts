import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { store, selectedCashier } = authContext
    
    return NextResponse.json({
      store: {
        id: store._id,
        storeName: store.storeName,
        isAdmin: store.isAdmin,
        cashiers: store.cashiers,
        selectedCashier: selectedCashier,
        logoImageUrl: store.logoImageUrl
      }
    })
  } catch (error: unknown) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
