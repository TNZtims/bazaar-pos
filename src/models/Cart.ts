import mongoose, { Document } from 'mongoose'

export interface ICartItem {
  product: mongoose.Types.ObjectId
  productName: string
  quantity: number
  unitPrice: number
  reservedAt: Date
}

export interface ICart extends Document {
  userId?: mongoose.Types.ObjectId // For authenticated users
  sessionId?: string // For anonymous users
  storeId: mongoose.Types.ObjectId
  items: ICartItem[]
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  notes?: string
  tax: number
  discount: number
  paymentMethod: 'cash' | 'card' | 'digital'
  paymentStatus: 'paid' | 'partial' | 'pending'
  amountPaid: number
  dueDate?: Date
  selectedCashier?: string
  expiresAt: Date // TTL for cart cleanup
  createdAt: Date
  updatedAt: Date
}

const cartItemSchema = new mongoose.Schema({
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
  reservedAt: {
    type: Date,
    default: Date.now
  }
})

const cartSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    sparse: true // Allow null values
  },
  sessionId: {
    type: String,
    sparse: true // Allow null values
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  items: [cartItemSchema],
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
    trim: true
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
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'digital'],
    default: 'cash'
  },
  paymentStatus: {
    type: String,
    enum: ['paid', 'partial', 'pending'],
    default: 'paid'
  },
  amountPaid: {
    type: Number,
    default: 0,
    min: 0
  },
  dueDate: {
    type: Date
  },
  selectedCashier: {
    type: String,
    trim: true
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
  }
}, {
  timestamps: true
})

// Compound index for efficient cart lookups
cartSchema.index({ userId: 1, storeId: 1 }, { sparse: true })
cartSchema.index({ sessionId: 1, storeId: 1 }, { sparse: true })
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }) // TTL index

// Ensure either userId or sessionId is provided
cartSchema.pre('validate', function(next) {
  if (!this.userId && !this.sessionId) {
    next(new Error('Either userId or sessionId must be provided'))
  } else {
    next()
  }
})

const Cart = mongoose.models.Cart || mongoose.model<ICart>('Cart', cartSchema)

export default Cart
