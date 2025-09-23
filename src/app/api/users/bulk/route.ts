import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import User from '@/models/User'
import { authenticateRequest } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authContext = await authenticateRequest(request)
    if (!authContext) {
      return NextResponse.json({ message: 'Authentication required' }, { status: 401 })
    }

    await connectToDatabase()

    const { users } = await request.json()

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json({ message: 'Users array is required' }, { status: 400 })
    }

    const errors: string[] = []
    const successCount = { count: 0 }
    const results = []

    // Validate all users first
    for (let i = 0; i < users.length; i++) {
      const userData = users[i]
      const lineNumber = userData.line || i + 1

      if (!userData.customId || !userData.customId.trim()) {
        errors.push(`Line ${lineNumber}: Customer ID is required`)
        continue
      }

      if (!userData.name || !userData.name.trim()) {
        errors.push(`Line ${lineNumber}: Name is required`)
        continue
      }

      // Check for duplicate customId in the store
      const existingUser = await User.findOne({ 
        customId: userData.customId.trim(), 
        storeId: authContext.store._id 
      })
      
      if (existingUser) {
        errors.push(`Line ${lineNumber}: Customer ID "${userData.customId}" already exists`)
        continue
      }

      // Check for duplicates within the upload batch
      const duplicateInBatch = users.slice(0, i).find(u => u.customId === userData.customId)
      if (duplicateInBatch) {
        errors.push(`Line ${lineNumber}: Duplicate Customer ID "${userData.customId}" in upload`)
        continue
      }

      results.push({
        customId: userData.customId.trim(),
        name: userData.name.trim(),
        storeId: authContext.store._id,
        isActive: true
      })
    }

    // If there are validation errors, return them without creating any users
    if (errors.length > 0) {
      return NextResponse.json({ 
        message: 'Validation failed', 
        errors,
        successCount: 0,
        totalCount: users.length
      }, { status: 400 })
    }

    // Create all users
    try {
      const createdUsers = await User.insertMany(results)
      successCount.count = createdUsers.length

      return NextResponse.json({
        message: `Successfully imported ${successCount.count} users`,
        successCount: successCount.count,
        totalCount: users.length,
        errors: []
      }, { status: 201 })
    } catch (error: any) {
      console.error('Bulk insert error:', error)

      // Handle MongoDB duplicate key errors
      if (error.code === 11000) {
        return NextResponse.json({
          message: 'Some users could not be created due to duplicate Customer IDs',
          errors: ['One or more Customer IDs already exist in the system'],
          successCount: 0,
          totalCount: users.length
        }, { status: 400 })
      }

      return NextResponse.json({
        message: 'Database error during bulk import',
        errors: [error.message || 'Unknown database error'],
        successCount: 0,
        totalCount: users.length
      }, { status: 500 })
    }

  } catch (error: any) {
    console.error('Bulk import error:', error)
    return NextResponse.json({ 
      message: 'Error during bulk import', 
      error: error.message,
      errors: [error.message || 'Unknown error'],
      successCount: 0,
      totalCount: 0
    }, { status: 500 })
  }
}
