import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import StarRating from '@/models/StarRating'
import { authenticateCustomerRequest } from '@/lib/auth'

// GET /api/star-ratings - Get star ratings for a store
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateCustomerRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Customer authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    
    if (!storeId) {
      return NextResponse.json(
        { message: 'Store ID is required' },
        { status: 400 }
      )
    }
    
    // Get all ratings for the store
    const ratings = await StarRating.find({ storeId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
    
    // Calculate average rating
    const totalRatings = ratings.length
    const averageRating = totalRatings > 0 
      ? ratings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings 
      : 0
    
    // Get user's rating if they have one
    const userRating = await StarRating.findOne({ 
      userId: authContext.user._id, 
      storeId 
    })
    
    return NextResponse.json({
      averageRating: Math.round(averageRating * 10) / 10, // Round to 1 decimal
      totalRatings,
      userRating: userRating ? userRating.rating : null,
      ratings: ratings.map(rating => ({
        _id: rating._id,
        rating: rating.rating,
        userId: rating.userId,
        createdAt: rating.createdAt
      }))
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error fetching star ratings', error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/star-ratings - Create or update a star rating
export async function POST(request: NextRequest) {
  try {
    const authContext = await authenticateCustomerRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Customer authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const body = await request.json()
    const { storeId, rating } = body
    
    if (!storeId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { message: 'Store ID and valid rating (1-5) are required' },
        { status: 400 }
      )
    }
    
    // Check if user already has a rating for this store
    const existingRating = await StarRating.findOne({
      userId: authContext.user._id,
      storeId
    })
    
    let savedRating
    
    if (existingRating) {
      // Update existing rating
      existingRating.rating = rating
      savedRating = await existingRating.save()
    } else {
      // Create new rating
      const newRating = new StarRating({
        userId: authContext.user._id,
        storeId,
        rating
      })
      savedRating = await newRating.save()
    }
    
    // Get updated store statistics
    const allRatings = await StarRating.find({ storeId })
    const totalRatings = allRatings.length
    const averageRating = totalRatings > 0 
      ? allRatings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings 
      : 0
    
    return NextResponse.json({
      message: existingRating ? 'Rating updated successfully' : 'Rating created successfully',
      rating: savedRating,
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings
    })
  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(
        { message: 'Rating already exists for this store' },
        { status: 400 }
      )
    }
    return NextResponse.json(
      { message: 'Error saving star rating', error: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/star-ratings - Remove a star rating
export async function DELETE(request: NextRequest) {
  try {
    const authContext = await authenticateCustomerRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Customer authentication required' },
        { status: 401 }
      )
    }
    
    await connectToDatabase()
    
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    
    if (!storeId) {
      return NextResponse.json(
        { message: 'Store ID is required' },
        { status: 400 }
      )
    }
    
    const deletedRating = await StarRating.findOneAndDelete({
      userId: authContext.user._id,
      storeId
    })
    
    if (!deletedRating) {
      return NextResponse.json(
        { message: 'Rating not found' },
        { status: 404 }
      )
    }
    
    // Get updated store statistics
    const allRatings = await StarRating.find({ storeId })
    const totalRatings = allRatings.length
    const averageRating = totalRatings > 0 
      ? allRatings.reduce((sum, rating) => sum + rating.rating, 0) / totalRatings 
      : 0
    
    return NextResponse.json({
      message: 'Rating removed successfully',
      averageRating: Math.round(averageRating * 10) / 10,
      totalRatings
    })
  } catch (error: any) {
    return NextResponse.json(
      { message: 'Error removing star rating', error: error.message },
      { status: 500 }
    )
  }
}
