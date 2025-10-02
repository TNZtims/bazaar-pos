import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import mongoose from 'mongoose'

// Define feedback schema
const feedbackSchema = new mongoose.Schema({
  storeId: { type: String, required: true },
  customerName: { type: String, required: true },
  comment: { type: String, required: true },
  rating: { type: Number, default: 5, min: 1, max: 5 },
  createdAt: { type: Date, default: Date.now },
  isVisible: { type: Boolean, default: true }
})

const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema)

export async function POST(request: NextRequest) {
  try {
    const { storeId, customerName, comment, rating } = await request.json()

    if (!storeId || !customerName || !comment) {
      return NextResponse.json(
        { error: 'Store ID, customer name, and comment are required' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    
    const feedback = new Feedback({
      storeId,
      customerName,
      comment,
      rating: rating || 5,
      isVisible: true
    })

    const savedFeedback = await feedback.save()
    
    return NextResponse.json({
      success: true,
      feedback: {
        _id: savedFeedback._id,
        storeId: savedFeedback.storeId,
        customerName: savedFeedback.customerName,
        comment: savedFeedback.comment,
        rating: savedFeedback.rating,
        createdAt: savedFeedback.createdAt,
        isVisible: savedFeedback.isVisible
      }
    })
  } catch (error) {
    console.error('Error creating feedback:', error)
    return NextResponse.json(
      { error: 'Failed to create feedback' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')

    if (!storeId) {
      return NextResponse.json(
        { error: 'Store ID is required' },
        { status: 400 }
      )
    }

    await connectToDatabase()
    
    const feedback = await Feedback.find({ 
      storeId, 
      isVisible: true 
    })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean()

    return NextResponse.json({ feedback })
  } catch (error) {
    console.error('Error fetching feedback:', error)
    return NextResponse.json(
      { error: 'Failed to fetch feedback' },
      { status: 500 }
    )
  }
}
