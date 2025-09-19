import mongoose, { Document, Model } from 'mongoose'
import bcrypt from 'bcryptjs'

export interface IStore extends Document {
  name: string
  address?: string
  phone?: string
  email?: string
  description?: string
  username: string
  password: string
  settings: {
    currency: string
    taxRate: number
    timezone: string
    businessHours?: {
      open: string
      close: string
      days: string[]
    }
  }
  subscription: {
    plan: 'basic' | 'premium' | 'enterprise'
    status: 'active' | 'suspended' | 'cancelled'
    expiresAt?: Date
  }
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  
  // Instance methods
  comparePassword(password: string): Promise<boolean>
}

const storeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  address: {
    type: String,
    trim: true,
    maxlength: 200
  },
  phone: {
    type: String,
    trim: true,
    maxlength: 20
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 500
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  settings: {
    currency: {
      type: String,
      default: 'PHP',
      maxlength: 3
    },
    taxRate: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    timezone: {
      type: String,
      default: 'Asia/Manila'
    },
    businessHours: {
      open: {
        type: String,
        default: '09:00'
      },
      close: {
        type: String,
        default: '18:00'
      },
      days: [{
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
      }]
    }
  },
  subscription: {
    plan: {
      type: String,
      enum: ['basic', 'premium', 'enterprise'],
      default: 'basic'
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'cancelled'],
      default: 'active'
    },
    expiresAt: {
      type: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

// Indexes
storeSchema.index({ name: 1 })
storeSchema.index({ email: 1 })
storeSchema.index({ isActive: 1 })

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
