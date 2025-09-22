import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import { authenticateAdminRequest } from '@/lib/auth'

// GET /api/users/[id] - Get single user (admin only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await authenticateAdminRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    await connectToDatabase()

    const { id } = await params
    const user = await User.findOne({ 
      _id: id, 
      storeId: authContext.store._id 
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(user)
  } catch (error: any) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { message: 'Error fetching user', error: error.message },
      { status: 500 }
    )
  }
}

// PUT /api/users/[id] - Update user (admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await authenticateAdminRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    await connectToDatabase()

    const { id } = await params
    const { customId, name, isActive } = await request.json()

    // Find user
    const user = await User.findOne({ 
      _id: id, 
      storeId: authContext.store._id 
    })

    if (!user) {
      return NextResponse.json({ message: 'User not found' }, { status: 404 })
    }

    // Update user
    if (customId !== undefined) user.customId = customId.trim()
    if (name !== undefined) user.name = name.trim()
    if (isActive !== undefined) user.isActive = isActive

    const updatedUser = await user.save()

    return NextResponse.json(updatedUser)
  } catch (error: any) {
    console.error('Error updating user:', error)
    return NextResponse.json(
      { message: 'Error updating user', error: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id] - Delete user (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authContext = await authenticateAdminRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Admin access required' },
        { status: 403 }
      )
    }

    await connectToDatabase()

    const { id } = await params
    const user = await User.findOneAndDelete({ 
      _id: id, 
      storeId: authContext.store._id 
    })

    if (!user) {
      return NextResponse.json(
        { message: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: 'User deleted successfully'
    })
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return NextResponse.json(
      { message: 'Error deleting user', error: error.message },
      { status: 500 }
    )
  }
}
