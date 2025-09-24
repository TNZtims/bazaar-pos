'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Order {
  _id: string
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
  totalAmount: number
  finalAmount: number
  status: string
  approvalStatus: string
  approvedBy?: string
  approvedAt?: string
  cashier?: string
  notes?: string
  createdAt: string
}

interface User {
  id: string
  customId: string
  name: string
}

interface Store {
  id: string
  name: string
}

export default function CustomerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  
  const params = useParams()
  const router = useRouter()
  const storeName = params.storeName as string
  const [storeId, setStoreId] = useState<string | null>(null)

  // Fetch store information and status using store name
  const fetchStoreInfo = async () => {
    try {
      const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeName)}`)
      if (response.ok) {
        const data = await response.json()
        setStore({ id: data.id, name: data.name })
        setStoreId(data.id) // Set the resolved store ID for other API calls
      } else {
        setError('Store not found')
      }
    } catch (err) {
      console.error('Error fetching store info:', err)
      setError('Failed to load store information')
    }
  }

  // Initialize store info first
  useEffect(() => {
    fetchStoreInfo()
  }, [storeName])

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/customer/me', {
          credentials: 'include'
        })
        
        if (!response.ok) {
          router.push(`/${storeName}/login`)
          return
        }
        
        const data = await response.json()
        setUser(data.user)
        // Don't overwrite store info from resolve, just use it for verification
        
        // Verify store matches URL (if storeId is available)
        if (storeId && data.store.id !== storeId) {
          router.push(`/${storeName}/login`)
          return
        }
        
      } catch (err) {
        router.push(`/${storeName}/login`)
      }
    }
    
    // Only run auth check when storeId is available
    if (storeId) {
      checkAuth()
    }
  }, [storeId, router, storeName])

  // Fetch orders
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return
      
      try {
        const response = await fetch('/api/orders/public', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          setOrders(data.orders)
        } else {
          setError('Failed to load orders')
        }
      } catch (err) {
        setError('Failed to load orders')
      } finally {
        setLoading(false)
      }
    }
    
    fetchOrders()
  }, [user])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
      case 'rejected': return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
      case 'paid': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
      case 'completed': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const handleDeleteOrder = async (orderId: string) => {
    if (deleting) return
    
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) {
      return
    }
    
    setDeleting(orderId)
    setError('')
    setSuccessMessage('')
    
    try {
      const response = await fetch(`/api/orders/public?orderId=${orderId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setSuccessMessage('Order deleted successfully!')
        // Remove the order from local state
        setOrders(prevOrders => prevOrders.filter(order => order._id !== orderId))
        setTimeout(() => setSuccessMessage(''), 5000)
      } else {
        setError(data.message || 'Failed to delete order')
      }
    } catch (err) {
      setError('Failed to delete order. Please try again.')
    } finally {
      setDeleting(null)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/customer/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } finally {
      router.push(`/${storeName}/login`)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center py-4 sm:py-0 sm:h-16">
            <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100 truncate">
                My Orders - {store?.name}
              </h1>
              <span className="text-sm text-gray-500 dark:text-slate-400">
                {user?.name}
              </span>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end space-x-4 mt-3 sm:mt-0">
              <button
                onClick={() => router.push(`/public/${storeId}/shop`)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm sm:text-base whitespace-nowrap px-2 py-1 touch-manipulation"
              >
                Continue Shopping
              </button>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300 text-sm sm:text-base px-2 py-1 touch-manipulation"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-6">
          Order History
        </h2>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
            <p className="text-green-800 dark:text-green-200">{successMessage}</p>
          </div>
        )}

        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 text-6xl mb-4">📦</div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
              No orders yet
            </h3>
            <p className="text-gray-600 dark:text-slate-400 mb-4">
              Start shopping to place your first order!
            </p>
            <button
              onClick={() => router.push(`/public/${storeId}/shop`)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Shopping
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => (
              <div
                key={order._id}
                className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                      Order #{order._id.slice(-6)}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-slate-400">
                      {new Date(order.createdAt).toLocaleDateString()} at{' '}
                      {new Date(order.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <div className="flex space-x-2 mb-2">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.approvalStatus)}`}
                      >
                        {order.approvalStatus.charAt(0).toUpperCase() + order.approvalStatus.slice(1)}
                      </span>
                      {order.status !== order.approvalStatus && (
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}
                        >
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </span>
                      )}
                      {(order.status === 'pending' && order.approvalStatus === 'pending') && (
                        <>
                          <button
                            onClick={() => router.push(`/public/${storeId}/shop?editOrder=${order._id}`)}
                            className="px-3 py-1 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(order._id)}
                            disabled={deleting === order._id}
                            className="px-3 py-1 bg-red-600 text-white text-xs rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                          >
                            {deleting === order._id ? 'Deleting...' : 'Delete'}
                          </button>
                        </>
                      )}
                    </div>
                    
                    {order.approvedBy && (
                      <p className="text-xs text-gray-500 dark:text-slate-400">
                        {order.approvalStatus === 'approved' ? 'Approved by' : 'Processed by'}: {order.approvedBy}
                      </p>
                    )}
                  </div>
                </div>

                {/* Order Items */}
                <div className="space-y-2 mb-4">
                  {order.items.map((item, index) => (
                    <div
                      key={index}
                      className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0"
                    >
                      <div>
                        <p className="font-medium text-gray-900 dark:text-slate-100">
                          {item.productName}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-slate-400">
                          ₱{item.unitPrice.toFixed(2)} × {item.quantity}
                        </p>
                      </div>
                      <p className="font-medium text-gray-900 dark:text-slate-100">
                        ₱{item.totalPrice.toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center border-t border-gray-200 dark:border-slate-600 pt-4">
                  <div>
                    {order.notes && (
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        <span className="font-medium">Notes:</span> {order.notes}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                      Total: ₱{order.finalAmount.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
