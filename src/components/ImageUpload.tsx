'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface ImageUploadProps {
  currentImage?: string
  onImageChange: (imageUrl: string) => void
  onImageRemove: () => void
  disabled?: boolean
}

interface UploadStatus {
  uploading: boolean
  progress: number
  error?: string
  success?: string
}

export default function ImageUpload({ 
  currentImage, 
  onImageChange, 
  onImageRemove, 
  disabled = false 
}: ImageUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ uploading: false, progress: 0 })
  const [showCamera, setShowCamera] = useState(false)
  const [cameraLoading, setCameraLoading] = useState(false)
  const [s3Config, setS3Config] = useState<any>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  // Check S3 configuration on component mount
  useEffect(() => {
    checkS3Config()
  }, [])

  // Cleanup camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const checkS3Config = async () => {
    try {
      const response = await fetch('/api/upload')
      const config = await response.json()
      setS3Config(config)
    } catch (error) {
      console.error('Failed to check S3 config:', error)
    }
  }

  // Upload file to S3 using presigned URL
  const uploadToS3 = async (file: File): Promise<string> => {
    try {
      setUploadStatus({ uploading: true, progress: 10 })

      // Get presigned URL
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // Include cookies for authentication
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to get upload URL')
      }

      const { uploadUrl, fileUrl } = await response.json()
      setUploadStatus({ uploading: true, progress: 30 })

      // Upload file to S3

      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        }
      })


      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text()
        console.error('❌ S3 Upload Error Details:', errorText)
        throw new Error(`Failed to upload file to S3: ${uploadResponse.status} ${uploadResponse.statusText}`)
      }

      setUploadStatus({ uploading: true, progress: 100 })
      
      setTimeout(() => {
        setUploadStatus({ 
          uploading: false, 
          progress: 0, 
          success: 'Image uploaded successfully!' 
        })
      }, 500)

      return fileUrl
    } catch (error: any) {
      setUploadStatus({ 
        uploading: false, 
        progress: 0, 
        error: error.message 
      })
      throw error
    }
  }

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    try {
      const imageUrl = await uploadToS3(file)
      onImageChange(imageUrl)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }, [onImageChange])

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  // Check if camera is available
  const isCameraAvailable = () => {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
  }

  // Start camera
  const startCamera = async () => {
    setCameraLoading(true)
    setUploadStatus({ uploading: false, progress: 0 }) // Clear any previous errors
    
    try {
      // Check if camera is available
      if (!isCameraAvailable()) {
        throw new Error('Camera not available on this device')
      }

      // Request camera permission and stream
      let constraints = {
        video: {
          facingMode: 'environment', // Prefer back camera
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        }
      }

      let stream: MediaStream
      try {
        // Try with preferred constraints first
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (error) {
        console.warn('Failed with preferred constraints, trying fallback:', error)
        // Fallback to basic constraints
        constraints = {
          video: true
        } as any
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      }
      
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // Wait for video to load before showing camera
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            videoRef.current.play()
            setShowCamera(true)
            setCameraLoading(false)
          }
        }

        // Handle video errors
        videoRef.current.onerror = (error) => {
          console.error('Video error:', error)
          setUploadStatus({ 
            uploading: false, 
            progress: 0, 
            error: 'Failed to load camera video stream.' 
          })
          setCameraLoading(false)
          stopCamera()
        }
      }
    } catch (error: any) {
      console.error('Failed to start camera:', error)
      let errorMessage = 'Failed to access camera. '
      
      if (error.name === 'NotAllowedError') {
        errorMessage += 'Please allow camera permissions and try again.'
      } else if (error.name === 'NotFoundError') {
        errorMessage += 'No camera found on this device.'
      } else if (error.name === 'NotSupportedError') {
        errorMessage += 'Camera not supported on this device.'
      } else if (error.message.includes('not available')) {
        errorMessage += 'Camera not available on this device.'
      } else {
        errorMessage += 'Please check camera permissions and try again.'
      }
      
      setUploadStatus({ 
        uploading: false, 
        progress: 0, 
        error: errorMessage 
      })
      setCameraLoading(false)
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setShowCamera(false)
    setCameraLoading(false)
  }

  // Capture photo from camera
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0)

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], `camera-${Date.now()}.jpg`, { type: 'image/jpeg' })
        stopCamera()
        
        try {
          await handleFileSelect(file)
        } catch (error) {
          console.error('Failed to upload camera photo:', error)
        }
      }
    }, 'image/jpeg', 0.8)
  }

  // Clear status messages after delay
  useEffect(() => {
    if (uploadStatus.success || uploadStatus.error) {
      const timer = setTimeout(() => {
        setUploadStatus({ uploading: false, progress: 0 })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [uploadStatus.success, uploadStatus.error])

  if (!s3Config?.configured) {
    return (
      <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Image upload is not configured. Using default images only.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Current Image Preview */}
      {currentImage && (
        <div className="relative">
          <img
            src={currentImage}
            alt="Product preview"
            className="w-32 h-32 object-cover border border-gray-300 dark:border-slate-600 rounded-lg"
          />
          <button
            type="button"
            onClick={onImageRemove}
            disabled={disabled || uploadStatus.uploading}
            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
      )}

      {/* Upload Buttons */}
      {!showCamera && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || uploadStatus.uploading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Image
          </button>

          <button
            type="button"
            onClick={startCamera}
            disabled={disabled || uploadStatus.uploading || !isCameraAvailable() || cameraLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-sm font-medium text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
            title={!isCameraAvailable() ? 'Camera not available on this device' : 'Take a photo using your camera'}
          >
            {cameraLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600 mr-2"></div>
            ) : (
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
            {cameraLoading ? 'Starting Camera...' : (isCameraAvailable() ? 'Take Photo' : 'Camera N/A')}
          </button>
        </div>
      )}

      {/* Camera Interface */}
      {showCamera && (
        <div className="space-y-4">
          <div className="relative bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls={false}
              className="w-full max-w-md aspect-video object-cover"
              style={{ transform: 'scaleX(-1)' }} // Mirror for selfie-like experience
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-32 sm:w-48 h-32 sm:h-48 border-2 border-white border-dashed rounded-lg opacity-50"></div>
            </div>
            {cameraLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                <div className="text-white text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-sm">Starting camera...</p>
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={capturePhoto}
              disabled={uploadStatus.uploading}
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              📸 Capture
            </button>
            <button
              type="button"
              onClick={stopCamera}
              disabled={uploadStatus.uploading}
              className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-md text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadStatus.uploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-slate-400">Uploading...</span>
            <span className="text-gray-600 dark:text-slate-400">{uploadStatus.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadStatus.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status Messages */}
      {uploadStatus.success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md">
          <p className="text-sm text-green-800 dark:text-green-200">{uploadStatus.success}</p>
        </div>
      )}

      {uploadStatus.error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
          <p className="text-sm text-red-800 dark:text-red-200">{uploadStatus.error}</p>
        </div>
      )}

      {/* Upload Constraints */}
      {s3Config && (
        <div className="text-xs text-gray-500 dark:text-slate-400">
          <p>Max file size: {Math.round(s3Config.maxFileSize / (1024 * 1024))}MB</p>
          <p>Supported: JPEG, PNG, WebP, GIF</p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  )
}
