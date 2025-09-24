import mongoose, { Document, Model } from 'mongoose'

export interface IPreorderItem {
  product: mongoose.Types.ObjectId
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface IPreorder extends Document {
  items: IPreorderItem[]
  totalAmount: number
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  customerId?: mongoose.Types.ObjectId
  customerCustomId?: string
  notes?: string
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'
  approvalStatus: 'pending' | 'approved' | 'rejected'
  paymentStatus: 'pending' | 'partial' | 'paid'
  paymentMethod?: 'cash' | 'card' | 'bank_transfer' | 'credit' | 'mixed'
  amountPaid: number
  amountDue: number
  payments: Array<{
    amount: number
    method: string
    date: Date
    notes?: string
  }>
  estimatedDeliveryDate?: Date
  actualDeliveryDate?: Date
  approvedBy?: string
  approvedAt?: Date
  cashier?: string
  storeId: mongoose.Types.ObjectId
  createdBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const preorderItemSchema = new mongoose.Schema({
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

const preorderSchema = new mongoose.Schema({
  items: [preorderItemSchema],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
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
    trim: true,
    lowercase: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  customerCustomId: {
    type: String,
    trim: true
  },
  notes: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'paid'],
    default: 'pending'
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'bank_transfer', 'credit', 'mixed']
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
  payments: [{
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    method: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    },
    notes: String
  }],
  estimatedDeliveryDate: {
    type: Date
  },
  actualDeliveryDate: {
    type: Date
  },
  approvedBy: {
    type: String,
    trim: true
  },
  approvedAt: {
    type: Date
  },
  cashier: {
    type: String,
    trim: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store'
  }
}, {
  timestamps: true
})

// Indexes for better performance
preorderSchema.index({ storeId: 1, createdAt: -1 })
preorderSchema.index({ storeId: 1, status: 1 })
preorderSchema.index({ storeId: 1, approvalStatus: 1 })
preorderSchema.index({ storeId: 1, paymentStatus: 1 })
preorderSchema.index({ customerId: 1, createdAt: -1 })
preorderSchema.index({ customerName: 'text', customerPhone: 'text', customerEmail: 'text' })

const Preorder: Model<IPreorder> = mongoose.models.Preorder || mongoose.model<IPreorder>('Preorder', preorderSchema)

export default Preorder
