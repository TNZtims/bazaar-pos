import { NextRequest, NextResponse } from 'next/server'
import connectToDatabase from '@/lib/mongodb'
import Store from '@/models/Store'
import { authenticateRequest } from '@/lib/auth'

// POST /api/stores/qr-codes - Upload QR code image
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

    const formData = await request.formData()
    const file = formData.get('file') as File
    const type = formData.get('type') as string

    if (!file || !type) {
      return NextResponse.json(
        { message: 'File and type are required' },
        { status: 400 }
      )
    }

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { message: 'Invalid file type. Only PNG, JPEG, GIF, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { message: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      )
    }

    // Validate QR code type
    if (!['gcash', 'gotyme', 'bpi'].includes(type)) {
      return NextResponse.json(
        { message: 'Invalid QR code type. Must be gcash, gotyme, or bpi.' },
        { status: 400 }
      )
    }

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // Update store with QR code
    const updateData: any = {}
    updateData[`qrCodes.${type}`] = dataUrl

    const updatedStore = await Store.findByIdAndUpdate(
      authContext.store._id,
      { $set: updateData },
      { new: true }
    )

    if (!updatedStore) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `${type.toUpperCase()} QR code uploaded successfully`,
      qrCodeUrl: dataUrl
    })

  } catch (error: any) {
    console.error('Error uploading QR code:', error)
    return NextResponse.json(
      { message: 'Error uploading QR code', error: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/stores/qr-codes - Remove QR code
export async function DELETE(request: NextRequest) {
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
    const type = searchParams.get('type')

    if (!type || !['gcash', 'gotyme', 'bpi'].includes(type)) {
      return NextResponse.json(
        { message: 'Invalid QR code type. Must be gcash, gotyme, or bpi.' },
        { status: 400 }
      )
    }

    // Remove QR code from store
    const updateData: any = {}
    updateData[`qrCodes.${type}`] = null

    const updatedStore = await Store.findByIdAndUpdate(
      authContext.store._id,
      { $set: updateData },
      { new: true }
    )

    if (!updatedStore) {
      return NextResponse.json(
        { message: 'Store not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      message: `${type.toUpperCase()} QR code removed successfully`
    })

  } catch (error: any) {
    console.error('Error removing QR code:', error)
    return NextResponse.json(
      { message: 'Error removing QR code', error: error.message },
      { status: 500 }
    )
  }
}
