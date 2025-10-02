import mongoose, { Document, Model } from 'mongoose'

export interface IStarRating extends Document {
  userId: mongoose.Types.ObjectId
  storeId: mongoose.Types.ObjectId
  rating: number  // 1-5 stars
  createdAt: Date
  updatedAt: Date
}

const starRatingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  }
}, {
  timestamps: true
})

// Ensure one rating per user per store
starRatingSchema.index({ userId: 1, storeId: 1 }, { unique: true })

// Index for efficient queries
starRatingSchema.index({ storeId: 1 })
starRatingSchema.index({ userId: 1 })

const StarRating: Model<IStarRating> = mongoose.models.StarRating || mongoose.model<IStarRating>('StarRating', starRatingSchema)

export default StarRating
