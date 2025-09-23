import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import { authenticateRequest } from '@/lib/auth'

// GET /api/users - Get all users
export async function GET(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const search = searchParams.get('search')
    const sortField = searchParams.get('sortField') || 'createdAt'
    const sortDirection = searchParams.get('sortDirection') || 'desc'

    const query: any = { storeId: authContext.store._id }

    // Search functionality
    if (search) {
      query.$or = [
        { customId: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } }
      ]
    }

    // Build sort object
    const sortObject: any = {}
    sortObject[sortField] = sortDirection === 'asc' ? 1 : -1

    const users = await User.find(query)
      .limit(limit)
      .skip((page - 1) * limit)
      .sort(sortObject)

    const total = await User.countDocuments(query)

    return NextResponse.json({
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    })
  } catch (error: any) {
    console.error('Error fetching users:', error)
    return NextResponse.json(
      { message: 'Error fetching users', error: error.message },
      { status: 500 }
    )
  }
}

// POST /api/users - Create new user
export async function POST(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      )
    }

    await connectToDatabase()

    const { customId, name } = await request.json()

    if (!customId || !name) {
      return NextResponse.json({ message: 'Custom ID and name are required' }, { status: 400 })
    }

    const existingUser = await User.findOne({ customId, storeId: authContext.store._id })
    if (existingUser) {
      return NextResponse.json({ message: 'User with this custom ID already exists in this store' }, { status: 400 })
    }

    const user = new User({
      customId,
      name,
      storeId: authContext.store._id,
      isActive: true
    })

    const savedUser = await user.save()

    return NextResponse.json(savedUser, { status: 201 })
  } catch (error: any) {
    console.error('Error creating user:', error)
    
    return NextResponse.json({ message: 'Error creating user', error: error.message }, { status: 500 })
  }
}
