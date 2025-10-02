import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import AuditLog from '@/models/AuditLog'

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase()
    
    const totalCount = await AuditLog.countDocuments()
    const recentLogs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
    
    console.log(`📊 Total audit logs in database: ${totalCount}`)
    console.log('📊 Recent audit logs:', recentLogs)
    
    return NextResponse.json({
      totalCount,
      recentLogs: recentLogs.map(log => ({
        id: log._id,
        productName: log.productName,
        action: log.action,
        quantityChange: log.quantityChange,
        createdAt: log.createdAt
      }))
    })
  } catch (error: any) {
    console.error('❌ Error checking audit logs:', error)
    return NextResponse.json(
      { message: 'Error checking audit logs', error: error.message },
      { status: 500 }
    )
  }
}
