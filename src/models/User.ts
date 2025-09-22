import mongoose, { Document, Model } from 'mongoose'

export interface IUser extends Document {
  customId: string // User-friendly ID for login
  name: string
  storeId: mongoose.Types.ObjectId // The store this user belongs to
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const userSchema = new mongoose.Schema({
  customId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    maxlength: 50
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
})

userSchema.index({ customId: 1, storeId: 1 }, { unique: true })
userSchema.index({ name: 1 })
userSchema.index({ storeId: 1, isActive: 1 })

// Ensure model is only compiled once
const User: Model<IUser> = mongoose.models.User || mongoose.model<IUser>('User', userSchema)

export default User
