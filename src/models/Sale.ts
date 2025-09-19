import mongoose, { Document, Model } from 'mongoose'

export interface ISaleItem {
  product: mongoose.Types.ObjectId
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface IPayment {
  amount: number
  method: 'cash' | 'card' | 'digital'
  date: Date
  notes?: string
}

export interface ISale extends Document {
  items: ISaleItem[]
  totalAmount: number
  subtotal: number
  tax: number
  discount: number
  finalAmount: number
  paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue'
  paymentMethod: 'cash' | 'card' | 'digital' | 'mixed'
  amountPaid: number
  amountDue: number
  payments: IPayment[]
  dueDate?: Date
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  notes?: string
  status: 'active' | 'completed' | 'cancelled' | 'refunded'
  storeId: mongoose.Types.ObjectId
  createdBy?: mongoose.Types.ObjectId
  modificationHistory?: Array<{
    action: string
    timestamp: Date
    changes: string
    userId?: string
  }>
  createdAt: Date
  updatedAt: Date
}

const saleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0
  },
  totalPrice: {
    type: Number,
    required: true,
    min: 0
  }
})

const paymentSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  method: {
    type: String,
    enum: ['cash', 'card', 'digital'],
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  }
})

const saleSchema = new mongoose.Schema({
  items: [saleItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  tax: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  finalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'pending', 'overdue'],
    default: 'paid'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'digital', 'mixed'],
    default: 'cash'
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  amountDue: {
    type: Number,
    default: 0,
    min: 0
  },
  payments: [paymentSchema],
  dueDate: {
    type: Date
  },
  customerName: {
    type: String,
    trim: true
  },
  customerPhone: {
    type: String,
    trim: true
  },
  customerEmail: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['active', 'completed', 'cancelled', 'refunded'],
    default: 'active'
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  modificationHistory: [{
    action: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    changes: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]
}, {
  timestamps: true
})

// Indexes for reporting queries
saleSchema.index({ createdAt: -1 })
saleSchema.index({ 'items.product': 1 })
saleSchema.index({ paymentStatus: 1 })
saleSchema.index({ storeId: 1 })
saleSchema.index({ storeId: 1, createdAt: -1 })
saleSchema.index({ storeId: 1, paymentStatus: 1 })
saleSchema.index({ status: 1 })
saleSchema.index({ dueDate: 1 })
saleSchema.index({ customerName: 1 })

const Sale: Model<ISale> = mongoose.models.Sale || mongoose.model<ISale>('Sale', saleSchema)

export default Sale
