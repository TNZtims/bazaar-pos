import mongoose, { Document, Model } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IStore extends Document {
  storeName: string
  password: string
  isActive: boolean
  isAdmin: boolean
  cashiers: string[]
  createdAt: Date
  updatedAt: Date
  
  // Instance methods
  comparePassword(password: string): Promise<boolean>
}

const storeSchema = new mongoose.Schema({
  storeName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  cashiers: [{
    type: String,
    trim: true,
    maxlength: 100
  }]
}, {
  timestamps: true
})

// Indexes
storeSchema.index({ storeName: 1 })
storeSchema.index({ isActive: 1 })
storeSchema.index({ isAdmin: 1 })

// Note: Password hashing is now done manually in the API routes

// Instance method to compare password
storeSchema.methods.comparePassword = async function(password: string): Promise<boolean> {
  if (!this.password) {
    return false
  }
  return bcrypt.compare(password, this.password)
}

// Ensure model is only compiled once
const Store: Model<IStore> = mongoose.models.Store || mongoose.model<IStore>('Store', storeSchema)

export default Store
