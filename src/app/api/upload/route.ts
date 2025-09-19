import { NextRequest, NextResponse } from 'next/server'
import { getPresignedUploadUrl, validateImageFile, isS3Configured, getS3Status } from '@/lib/s3'
import { authenticateRequest } from '@/lib/auth'

// GET /api/upload - Get S3 configuration status
export async function GET() {
  try {
    const status = getS3Status()
    return NextResponse.json(status)
  } catch (error) {
    console.error('Error getting S3 status:', error)
    return NextResponse.json(
      { error: 'Failed to get upload status' },
      { status: 500 }
    )
  }
}

// POST /api/upload - Generate presigned URL for image upload
export async function POST(request: NextRequest) {
  try {
    const authContext = await authenticateRequest(request)
    
    if (!authContext) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Check if S3 is configured
    if (!isS3Configured()) {
      return NextResponse.json(
        { 
          error: 'Image upload not configured. Please contact administrator.',
          debug: 'S3_NOT_CONFIGURED'
        },
        { status: 503 }
      )
    }

    const body = await request.json()
    const { fileName, fileType, fileSize } = body

    // Validate required fields
    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields: fileName, fileType, fileSize' },
        { status: 400 }
      )
    }

    // Create a mock file object for validation
    const mockFile = {
      name: fileName,
      type: fileType,
      size: fileSize
    } as File

    // Validate the file
    const validation = validateImageFile(mockFile)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      )
    }

    // Generate presigned URL
    const uploadData = await getPresignedUploadUrl(fileName, fileType)

    return NextResponse.json({
      success: true,
      uploadUrl: uploadData.uploadUrl,
      fileUrl: uploadData.fileUrl,
      key: uploadData.key,
      message: 'Upload URL generated successfully'
    })

  } catch (error: unknown) {
    console.error('Error generating upload URL:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to generate upload URL',
        details: error.message,
        debug: 'PRESIGNED_URL_ERROR'
      },
      { status: 500 }
    )
  }
}

// OPTIONS /api/upload - Handle CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}
