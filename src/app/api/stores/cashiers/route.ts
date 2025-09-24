import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { authenticateRequest } from '@/lib/auth'

// PUT /api/stores/cashiers - Update cashiers list
export async function PUT(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    const { cashiers } = await request.json()

    if (!Array.isArray(cashiers)) {
      return NextResponse.json(
        { message: 'Cashiers must be an array' },
        { status: 400 }
      )
    }

    // Validate cashier names
    for (const cashier of cashiers) {
      if (typeof cashier !== 'string' || !cashier.trim()) {
        return NextResponse.json(
          { message: 'All cashier names must be non-empty strings' },
          { status: 400 }
        )
      }
    }

    // Remove duplicates and trim
    const uniqueCashiers = [...new Set(cashiers.map(c => c.trim()).filter(c => c))]

    const updatedStore = await Store.findByIdAndUpdate(
      authContext.store._id,
      { cashiers: uniqueCashiers },
      { new: true }
    )

    if (!updatedStore) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'Cashiers updated successfully',
      cashiers: updatedStore.cashiers
    })

  } catch (error: any) {
    console.error('Error updating cashiers:', error)
    return NextResponse.json(
      { message: 'Error updating cashiers', error: error.message },
      { status: 500 }
    )
  }
}

// GET /api/stores/cashiers - Get cashiers list
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      cashiers: authContext.store.cashiers || []
    })

  } catch (error: any) {
    console.error('Error fetching cashiers:', error)
    return NextResponse.json(
      { message: 'Error fetching cashiers', error: error.message },
      { status: 500 }
    )
  }
}
