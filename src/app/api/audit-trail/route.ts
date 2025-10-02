import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import AuditLog from '@/models/AuditLog'
import { authenticateRequest } from '@/lib/auth'
import { getAuditLogs } from '@/lib/audit-logger'

// GET /api/audit-trail - Get audit logs with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '25')
    const storeId = searchParams.get('storeId')
    const productId = searchParams.get('productId')
    const action = searchParams.get('action')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const search = searchParams.get('search')
    
    console.log('🔍 Audit Trail API: Request params:', {
      page,
      limit,
      storeId,
      productId,
      action,
      startDate,
      endDate,
      search,
      isAdmin: authContext.isAdmin
    })
    
    // Determine storeId based on user role
    let finalStoreId = storeId
    if (!authContext.isAdmin) {
      // Non-admin users can only see their store's logs
      finalStoreId = authContext.store._id.toString()
    } else if (!storeId || storeId === 'all') {
      // Admin can see all stores if no specific store is selected
      finalStoreId = undefined
    }
    
    const result = await getAuditLogs({
      storeId: finalStoreId,
      productId: productId || undefined,
      action: action || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      page,
      limit,
      search: search || undefined
    })
    
    console.log(`🔍 Audit Trail API: Found ${result.logs.length} logs, total: ${result.total}`)
    
    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('❌ Audit Trail API Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { message: 'Error fetching audit logs', error: errorMessage },
      { status: 500 }
    )
  }
}
