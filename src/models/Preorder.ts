import mongoose, { Document, Model } from 'mongoose'

export interface IPreorder extends Document {
  customerName: string
  customerPhone?: string
  customerEmail?: string
  items: {
    product: mongoose.Types.ObjectId
    productName: string
    quantity: number
    unitPrice: number
  }[]
  totalAmount: number
  notes?: string
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled'
  approvalStatus: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  storeId: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const preorderSchema = new mongoose.Schema({
  customerName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  customerPhone: {
    type: String,
    trim: true,
    maxlength: 20
  },
  customerEmail: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 100
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    productName: {
      type: String,
      required: true,
      trim: true
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
    }
  }],
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'fulfilled'],
    default: 'pending'
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  approvedBy: {
    type: String,
    trim: true,
    maxlength: 100
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  }
}, {
  timestamps: true
})

// Index for better query performance
preorderSchema.index({ storeId: 1, status: 1 })
preorderSchema.index({ storeId: 1, approvalStatus: 1 })
preorderSchema.index({ createdAt: -1 })

const Preorder: Model<IPreorder> = mongoose.models.Preorder || mongoose.model<IPreorder>('Preorder', preorderSchema)

export default Preorder
