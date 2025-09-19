/**
 * API Helper Functions
 * Utilities for consistent API responses and error handling
 */

import { NextResponse } from 'next/server'

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  message?: string
  error?: string
}

export function successResponse<T>(data: T, message?: string, status = 200) {
  return NextResponse.json({
    success: true,
    data,
    message
  } as ApiResponse<T>, { status })
}

export function errorResponse(message: string, error?: string, status = 500) {
  return NextResponse.json({
    success: false,
    message,
    error
  } as ApiResponse, { status })
}

export function validationError(message: string, details?: any) {
  return NextResponse.json({
    success: false,
    message,
    error: 'Validation Error',
    details
  } as ApiResponse, { status: 400 })
}

export function notFoundError(resource: string) {
  return NextResponse.json({
    success: false,
    message: `${resource} not found`,
    error: 'Not Found'
  } as ApiResponse, { status: 404 })
}

export function handleApiError(error: any, operation: string) {
  console.error(`Error in ${operation}:`, error)
  
  // Handle specific MongoDB errors
  if (error.code === 11000) {
    const field = Object.keys(error.keyPattern || {})[0]
    return errorResponse(
      `Duplicate ${field} already exists`,
      'Duplicate Key Error',
      400
    )
  }
  
  // Handle validation errors
  if (error.name === 'ValidationError') {
    const messages = Object.values(error.errors).map((err: any) => err.message)
    return validationError('Validation failed', messages)
  }
  
  // Handle cast errors (invalid ObjectId, etc.)
  if (error.name === 'CastError') {
    return validationError(`Invalid ${error.path}: ${error.value}`)
  }
  
  // Generic error
  return errorResponse(
    `Error in ${operation}`,
    error.message
  )
}

export function parseQueryParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '10')))
  const search = searchParams.get('search')?.trim()
  const sort = searchParams.get('sort') || '-createdAt'
  
  return { page, limit, search, sort, skip: (page - 1) * limit }
}

export function buildPaginationResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
) {
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPrevPage: page > 1
    }
  }
}
