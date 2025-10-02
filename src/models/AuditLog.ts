import mongoose, { Document, Model } from 'mongoose'

export interface IAuditLog extends Document {
  productId: mongoose.Types.ObjectId
  productName: string
  storeId: mongoose.Types.ObjectId
  storeName: string
  action: 'sale' | 'reservation' | 'restock' | 'adjustment' | 'preorder' | 'cancellation' | 'refund'
  quantityChange: number // Positive for additions, negative for deductions
  previousQuantity: number
  newQuantity: number
  reason?: string
  orderId?: mongoose.Types.ObjectId
  customerName?: string
  cashier?: string
  userId?: mongoose.Types.ObjectId // User who performed the action
  metadata?: {
    orderType?: 'sale' | 'preorder' | 'reservation'
    paymentStatus?: string
    customerPhone?: string
    customerEmail?: string
    notes?: string
  }
  createdAt: Date
  updatedAt: Date
}

const auditLogSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  storeName: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['sale', 'reservation', 'restock', 'adjustment', 'preorder', 'cancellation', 'refund'],
    required: true
  },
  quantityChange: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: false
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale',
    required: false
  },
  customerName: {
    type: String,
    required: false
  },
  cashier: {
    type: String,
    required: false
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  metadata: {
    orderType: {
      type: String,
      enum: ['sale', 'preorder', 'reservation'],
      required: false
    },
    paymentStatus: {
      type: String,
      required: false
    },
    customerPhone: {
      type: String,
      required: false
    },
    customerEmail: {
      type: String,
      required: false
    },
    notes: {
      type: String,
      required: false
    }
  }
}, {
  timestamps: true
})

// Indexes for efficient queries
auditLogSchema.index({ productId: 1, createdAt: -1 })
auditLogSchema.index({ storeId: 1, createdAt: -1 })
auditLogSchema.index({ action: 1, createdAt: -1 })
auditLogSchema.index({ orderId: 1 })
auditLogSchema.index({ userId: 1, createdAt: -1 })
auditLogSchema.index({ createdAt: -1 })

const AuditLog: Model<IAuditLog> = mongoose.models.AuditLog || mongoose.model<IAuditLog>('AuditLog', auditLogSchema)

export default AuditLog
