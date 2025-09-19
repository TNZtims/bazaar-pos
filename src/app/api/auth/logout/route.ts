import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const response = NextResponse.json({
      message: 'Logout successful'
    })
    
    // Clear auth cookie
    response.cookies.delete('auth-token')
    
    return response
  } catch (error: unknown) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { message: 'Internal server error' },
      { status: 500 }
    )
  }
}
