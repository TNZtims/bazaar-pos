import mongoose, { Document, Model } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IStore extends Document {
  storeName: string
  password: string
  isActive: boolean
  isAdmin: boolean
  cashiers: string[]
  isOnline: boolean
  isLocked: boolean
  bannerImageUrl?: string
  logoImageUrl?: string
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
  }],
  isOnline: {
    type: Boolean,
    default: true
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  storeHours: {
    type: {
      monday: { open: String, close: String, closed: { type: Boolean, default: false } },
      tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
      thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
      friday: { open: String, close: String, closed: { type: Boolean, default: false } },
      saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
      sunday: { open: String, close: String, closed: { type: Boolean, default: false } }
    },
    default: {
      monday: { open: '09:00', close: '18:00', closed: false },
      tuesday: { open: '09:00', close: '18:00', closed: false },
      wednesday: { open: '09:00', close: '18:00', closed: false },
      thursday: { open: '09:00', close: '18:00', closed: false },
      friday: { open: '09:00', close: '18:00', closed: false },
      saturday: { open: '09:00', close: '18:00', closed: false },
      sunday: { open: '10:00', close: '16:00', closed: false }
    }
  },
  bannerImageUrl: {
    type: String,
    trim: true,
    default: null
  },
  logoImageUrl: {
    type: String,
    trim: true,
    default: null
  }
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
