import { NextRequest } from 'next/server'
import { authenticateRequest } from '@/lib/auth'
import connectToDatabase from '@/lib/mongodb'
import Product from '@/models/Product'

export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authContext = await authenticateRequest(request)
    if (!authContext) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const productIds = searchParams.get('products')?.split(',') || []

    if (productIds.length === 0) {
      return new Response('No product IDs provided', { status: 400 })
    }

    // Set up SSE response
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        
        // Send initial data
        const sendInitialData = async () => {
          try {
            await connectToDatabase()
            const products = await Product.find({
              _id: { $in: productIds },
              storeId: authContext.store._id
            }).select('_id totalQuantity availableQuantity reservedQuantity updatedAt')

            const updates = products.map(product => ({
              productId: product._id.toString(),
              totalQuantity: product.totalQuantity,
              availableQuantity: product.availableQuantity,
              reservedQuantity: product.reservedQuantity,
              updatedAt: product.updatedAt.toISOString()
            }))

            const data = `data: ${JSON.stringify({ 
              type: 'initial', 
              updates,
              timestamp: new Date().toISOString()
            })}\n\n`
            
            controller.enqueue(encoder.encode(data))
          } catch (err) {
            console.error('Error sending initial data:', err)
          }
        }

        sendInitialData()

        // Send heartbeat every 30 seconds to keep connection alive
        const heartbeatInterval = setInterval(() => {
          try {
            const heartbeat = `data: ${JSON.stringify({ 
              type: 'heartbeat', 
              timestamp: new Date().toISOString() 
            })}\n\n`
            controller.enqueue(encoder.encode(heartbeat))
          } catch (err) {
            console.error('Error sending heartbeat:', err)
            clearInterval(heartbeatInterval)
          }
        }, 30000)

        // Store the intervals for cleanup
        request.signal.addEventListener('abort', () => {
          clearInterval(heartbeatInterval)
          controller.close()
        })
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })
  } catch (error) {
    console.error('SSE stream error:', error)
    return new Response('Internal Server Error', { status: 500 })
  }
}
