import mongoose, { Document, Model } from 'mongoose'

export interface IProduct extends Document {
  name: string
  cost?: number
  price: number
  discountPrice?: number     // Discounted price (if > 0, product is on sale)
  quantity: number           // Current stock quantity
  initialStock?: number      // Static note: original stock amount when product was first added (standalone reference)
  availableForPreorder: boolean // Whether item is available for preorder
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
  discountPrice: {
    type: Number,
    required: false,
    min: 0,
    default: null
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  initialStock: {
    type: Number,
    required: false,  // Make it optional since it's a note field
    min: 0,
    default: null     // Default to null instead of 0 to indicate "not set"
  },
  availableForPreorder: {
    type: Boolean,
    default: false
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

// Pre-validation hook to validate discount price against regular price
productSchema.pre('validate', function(this: IProduct) {
  // Validate discount price if it's being set
  if (this.discountPrice !== null && this.discountPrice !== undefined && this.discountPrice > 0) {
    console.log('🔍 Pre-validation - discountPrice:', this.discountPrice, 'price:', this.price)
    if (this.discountPrice >= this.price) {
      this.invalidate('discountPrice', 'Discount price must be less than the regular price')
    }
  }
})

// Middleware to automatically sync availableQuantity and legacy quantity field
// No complex middleware needed - using simple quantity field

// Index for better search performance
productSchema.index({ name: 'text', description: 'text' })
productSchema.index({ category: 1 })
productSchema.index({ storeId: 1 })
productSchema.index({ storeId: 1, sku: 1 }, { unique: true })

const Product: Model<IProduct> = mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema)

export default Product
