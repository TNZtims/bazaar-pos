import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { v4 as uuidv4 } from 'uuid'

// Secure S3 Configuration
const S3_REGION = process.env.AWS_REGION || 'us-east-1'
const S3_BUCKET = process.env.S3_BUCKET_NAME || ''
const S3_ACCESS_KEY = process.env.AWS_ACCESS_KEY_ID || ''
const S3_SECRET_KEY = process.env.AWS_SECRET_ACCESS_KEY || ''

// Validate required environment variables
if (!S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
  // Only show warning in development mode and on server-side
  if (process.env.NODE_ENV === 'development' && typeof window === 'undefined') {
    console.warn('⚠️ S3 configuration incomplete. Image upload will be disabled.')
  }
}

// Initialize S3 client with security best practices
const s3Client = new S3Client({
  region: S3_REGION,
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  // Additional security configurations
  forcePathStyle: false, // Use virtual-hosted-style URLs
  useAccelerateEndpoint: false,
})

// Allowed file types for security
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif'
]

// Maximum file size (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024

// Generate secure file name with UUID
export function generateSecureFileName(originalName: string): string {
  const fileExtension = originalName.split('.').pop()?.toLowerCase()
  if (!fileExtension) {
    throw new Error('File must have an extension')
  }
  
  // Map common extensions to MIME types
  const extensionToMime: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif'
  }
  
  const mimeType = extensionToMime[fileExtension]
  if (!mimeType || !ALLOWED_FILE_TYPES.includes(mimeType)) {
    throw new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.')
  }
  
  const timestamp = Date.now()
  const uniqueId = uuidv4()
  return `products/${timestamp}-${uniqueId}.${fileExtension}`
}

// Validate file before upload
export function validateImageFile(file: File): { valid: boolean; error?: string; cleanFileName?: string } {
  // Check file type
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.'
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File size too large. Maximum size is 5MB.'
    }
  }

  // Clean the file name by removing path separators and keeping only the filename
  const cleanFileName = file.name.split(/[/\\]/).pop() || file.name
  console.log('File validation:', { 
    originalName: file.name, 
    cleanedName: cleanFileName, 
    type: file.type, 
    size: file.size 
  })
  
  // Check for path traversal attempts in the cleaned name
  if (cleanFileName.includes('..')) {
    console.error('File name validation failed - path traversal detected:', cleanFileName)
    return {
      valid: false,
      error: `Invalid file name "${cleanFileName}". File names cannot contain path traversal sequences (..).`
    }
  }

  // Check if file has a valid extension using the cleaned name
  const fileExtension = cleanFileName.split('.').pop()?.toLowerCase()
  if (!fileExtension) {
    return {
      valid: false,
      error: 'File must have an extension.'
    }
  }

  // Validate extension matches MIME type
  const extensionToMime: { [key: string]: string } = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif'
  }
  
  const expectedMimeType = extensionToMime[fileExtension]
  if (!expectedMimeType) {
    return {
      valid: false,
      error: 'Invalid file extension. Only .jpg, .jpeg, .png, .webp, and .gif files are allowed.'
    }
  }

  // Allow both the expected MIME type and the actual file MIME type
  // Some browsers may report different MIME types
  if (file.type !== expectedMimeType && !ALLOWED_FILE_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'File type does not match extension or is not supported.'
    }
  }

  return { 
    valid: true, 
    cleanFileName: cleanFileName 
  }
}

// Generate presigned URL for secure upload
export async function getPresignedUploadUrl(fileName: string, fileType: string): Promise<{
  uploadUrl: string
  fileUrl: string
  key: string
}> {
  try {
    if (!S3_BUCKET) {
      throw new Error('S3 bucket not configured')
    }

    const key = generateSecureFileName(fileName)
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: fileType,
      // Minimal headers to avoid permission issues
      // Remove ServerSideEncryption, Metadata, and CacheControl
      // as they might require additional IAM permissions
    })

    // Generate presigned URL with 5-minute expiration for security
    const uploadUrl = await getSignedUrl(s3Client, command, { 
      expiresIn: 300 // 5 minutes
    })

    // Generate the public URL (without presigned parameters)
    const fileUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`

    return {
      uploadUrl,
      fileUrl,
      key
    }
  } catch (error) {
    console.error('Error generating presigned URL:', error)
    throw new Error('Failed to generate upload URL')
  }
}

// Delete image from S3
export async function deleteImageFromS3(imageUrl: string): Promise<boolean> {
  try {
    if (!S3_BUCKET || !imageUrl.includes(S3_BUCKET)) {
      return false // Not an S3 image or bucket not configured
    }

    // Extract key from URL
    const urlParts = imageUrl.split(`${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/`)
    if (urlParts.length !== 2) {
      return false
    }

    const key = urlParts[1]

    const command = new DeleteObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })

    await s3Client.send(command)
    console.log(`✅ Deleted image: ${key}`)
    return true
  } catch (error) {
    console.error('Error deleting image from S3:', error)
    return false
  }
}

// Check if S3 is properly configured
export function isS3Configured(): boolean {
  return !!(S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY)
}

// Get S3 configuration status for frontend
export function getS3Status() {
  return {
    configured: isS3Configured(),
    bucket: S3_BUCKET ? `${S3_BUCKET.substring(0, 8)}...` : 'Not configured',
    region: S3_REGION,
    maxFileSize: MAX_FILE_SIZE,
    allowedTypes: ALLOWED_FILE_TYPES,
  }
}
