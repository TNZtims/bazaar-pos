import mongoose, { Document, Model } from 'mongoose'

export interface IProduct extends Document {
  name: string
  cost?: number
  price: number
  quantity: number
  description?: string
  category?: string
  sku?: string
  imageUrl?: string
  storeId: mongoose.Types.ObjectId
  createdBy?: mongoose.Types.ObjectId
  updatedBy?: mongoose.Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  cost: {
    type: Number,
    required: false,
    min: 0,
    default: null
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  category: {
    type: String,
    trim: true,
    maxlength: 50
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true
  },
  imageUrl: {
    type: String,
    trim: true,
    default: null
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
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
})

// Index for better search performance
productSchema.index({ name: 'text', description: 'text' })
productSchema.index({ category: 1 })
productSchema.index({ storeId: 1 })
productSchema.index({ storeId: 1, sku: 1 }, { unique: true })

const Product: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema)

export default Product
