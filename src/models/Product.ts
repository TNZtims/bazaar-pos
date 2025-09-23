import mongoose, { Document, Model } from 'mongoose'

export interface IProduct extends Document {
  name: string
  cost?: number
  price: number
  totalQuantity: number      // Total stock
  availableQuantity: number  // Available for sale (totalQuantity - reservedQuantity)
  reservedQuantity: number   // Reserved for pending orders
  // Legacy field for backward compatibility
  quantity: number           // Will map to totalQuantity
  description?: string
  category?: string
  sku?: string
  seller?: string            // Seller/supplier name
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
  totalQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  availableQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  reservedQuantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  // Legacy field for backward compatibility
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
  seller: {
    type: String,
    trim: true,
    maxlength: 100
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

// Middleware to automatically sync availableQuantity and legacy quantity field
productSchema.pre('save', function(next) {
  // In simplified model: availableQuantity = totalQuantity (no reservations)
  this.availableQuantity = Math.max(0, this.totalQuantity)
  
  // Sync legacy quantity field for backward compatibility
  this.quantity = this.totalQuantity
  
  next()
})

productSchema.pre('findOneAndUpdate', function(next) {
  const update = this.getUpdate() as any
  if (update && update.totalQuantity !== undefined) {
    // In simplified model: availableQuantity = totalQuantity
    update.availableQuantity = Math.max(0, update.totalQuantity)
    update.quantity = update.totalQuantity
  }
  next()
})

// Index for better search performance
productSchema.index({ name: 'text', description: 'text' })
productSchema.index({ category: 1 })
productSchema.index({ storeId: 1 })
productSchema.index({ storeId: 1, sku: 1 }, { unique: true })

const Product: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema)

export default Product
