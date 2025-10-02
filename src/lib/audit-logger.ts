import AuditLog, { IAuditLog } from '@/models/AuditLog'
import connectToDatabase from '@/lib/mongodb'
import { Types } from 'mongoose'

interface CreateAuditLogParams {
  productId: string
  productName: string
  storeId: string
  storeName: string
  action: 'sale' | 'reservation' | 'restock' | 'adjustment' | 'preorder' | 'cancellation' | 'refund'
  quantityChange: number
  previousQuantity: number
  newQuantity: number
  reason?: string
  orderId?: string
  customerName?: string
  cashier?: string
  userId?: string
  metadata?: {
    orderType?: 'sale' | 'preorder' | 'reservation'
    paymentStatus?: string
    customerPhone?: string
    customerEmail?: string
    notes?: string
  }
}

export async function createAuditLog(params: CreateAuditLogParams): Promise<void> {
  try {
    console.log('🔍 Creating audit log with params:', {
      productId: params.productId,
      productName: params.productName,
      storeId: params.storeId,
      storeName: params.storeName,
      action: params.action,
      quantityChange: params.quantityChange,
      previousQuantity: params.previousQuantity,
      newQuantity: params.newQuantity
    })
    
    await connectToDatabase()
    
    const auditLog = new AuditLog({
      productId: new Types.ObjectId(params.productId),
      productName: params.productName,
      storeId: new Types.ObjectId(params.storeId),
      storeName: params.storeName,
      action: params.action,
      quantityChange: params.quantityChange,
      previousQuantity: params.previousQuantity,
      newQuantity: params.newQuantity,
      reason: params.reason,
      orderId: params.orderId ? new Types.ObjectId(params.orderId) : undefined,
      customerName: params.customerName,
      cashier: params.cashier,
      userId: params.userId ? new Types.ObjectId(params.userId) : undefined,
      metadata: params.metadata
    })
    
    const savedLog = await auditLog.save()
    console.log(`✅ Audit Log Created Successfully: ${params.action} - ${params.productName} (${params.quantityChange > 0 ? '+' : ''}${params.quantityChange}) - ID: ${savedLog._id}`)
  } catch (error) {
    console.error('❌ Error creating audit log:', error)
    console.error('❌ Audit log params that failed:', params)
    // Don't throw error to prevent breaking the main operation
  }
}

export async function getAuditLogs(params: {
  storeId?: string
  productId?: string
  action?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
  search?: string
}): Promise<{
  logs: IAuditLog[]
  total: number
  totalPages: number
  currentPage: number
}> {
  try {
    console.log('🔍 getAuditLogs called with params:', params)
    
    await connectToDatabase()
    
    const query: any = {}
    
    if (params.storeId) {
      query.storeId = new Types.ObjectId(params.storeId)
    }
    
    if (params.productId) {
      query.productId = new Types.ObjectId(params.productId)
    }
    
    if (params.action) {
      query.action = params.action
    }
    
    if (params.startDate || params.endDate) {
      query.createdAt = {}
      if (params.startDate) {
        query.createdAt.$gte = new Date(params.startDate)
      }
      if (params.endDate) {
        query.createdAt.$lte = new Date(params.endDate)
      }
    }
    
    if (params.search) {
      const searchRegex = { $regex: params.search, $options: 'i' }
      query.$or = [
        { productName: searchRegex },
        { customerName: searchRegex },
        { cashier: searchRegex },
        { reason: searchRegex },
      ]
    }
    
    const page = params.page || 1
    const limit = params.limit || 50
    
    console.log('🔍 getAuditLogs query:', JSON.stringify(query, null, 2))
    
    const logs = await AuditLog.find(query)
      .populate('productId', 'name sku')
      .populate('storeId', 'storeName')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit)
    
    const total = await AuditLog.countDocuments(query)
    
    console.log(`🔍 getAuditLogs result: ${logs.length} logs found, total: ${total}`)
    
    return {
      logs,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page
    }
  } catch (error) {
    console.error('❌ Error fetching audit logs:', error)
    throw error
  }
}
