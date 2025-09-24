'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useToast } from '@/contexts/ToastContext'

interface Product {
  _id: string
  name: string
  price: number
  availableForPreorder: boolean
  imageUrl?: string
  totalQuantity: number
  availableQuantity: number
  reservedQuantity: number
}

interface PreorderItem {
  product: Product
  quantity: number
}

interface PreorderOrder {
  _id: string
  items: PreorderItem[]
  totalAmount: number
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  status: string
  paymentStatus: string
  createdAt: string
  notes?: string
}

export default function PreordersPage() {
  const { success, error } = useToast()
  const [orders, setOrders] = useState<PreorderOrder[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'orders' | 'products'>('orders')
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [approvalStatusFilter, setApprovalStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('-createdAt')
  const [showFilters, setShowFilters] = useState(false)

  useEffect(() => {
    fetchPreorderOrders()
    fetchPreorderProducts()
  }, [searchTerm, dateFrom, dateTo, statusFilter, paymentStatusFilter, approvalStatusFilter, sortBy])

  const fetchPreorderOrders = async () => {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        limit: '100',
        sort: sortBy
      })
      
      if (searchTerm) params.append('search', searchTerm)
      if (dateFrom) params.append('startDate', dateFrom)
      if (dateTo) params.append('endDate', dateTo)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (paymentStatusFilter !== 'all') params.append('paymentStatus', paymentStatusFilter)
      if (approvalStatusFilter !== 'all') params.append('approvalStatus', approvalStatusFilter)
      
      const response = await fetch(`/api/preorders?${params}`)
      if (response.ok) {
        const data = await response.json()
        setOrders(data.preorders || [])
      }
    } catch (err) {
      console.error('Error fetching preorder orders:', err)
    }
  }

  const fetchPreorderProducts = async () => {
    try {
      const response = await fetch('/api/products?preorderOnly=true')
      if (response.ok) {
        const data = await response.json()
        setProducts(data.products || [])
      }
    } catch (err) {
      console.error('Error fetching preorder products:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-slate-400">Loading preorders...</p>
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Preorders</h1>
              <p className="text-gray-600 dark:text-slate-400">Manage preorder products and customer orders</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 dark:border-slate-700">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setActiveTab('orders')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'orders'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                Preorder Orders ({orders.length})
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'products'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-slate-400 dark:hover:text-slate-300'
                }`}
              >
                Preorder Products ({products.length})
              </button>
            </nav>
          </div>

          {/* Filters */}
          {activeTab === 'orders' && (
            <div className="border-b border-gray-200 dark:border-slate-700 pb-6">
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  <span>Filters</span>
                  <span className={`transform transition-transform ${showFilters ? 'rotate-180' : ''}`}>▼</span>
                </button>
                
                {(searchTerm || dateFrom || dateTo || statusFilter !== 'all' || paymentStatusFilter !== 'all' || approvalStatusFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchTerm('')
                      setDateFrom('')
                      setDateTo('')
                      setStatusFilter('all')
                      setPaymentStatusFilter('all')
                      setApprovalStatusFilter('all')
                    }}
                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300"
                  >
                    Clear Filters
                  </button>
                )}
              </div>
              
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Search
                    </label>
                    <input
                      type="text"
                      placeholder="Customer name, order ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  
                  {/* Date From */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  
                  {/* Date To */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  
                  {/* Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Status
                    </label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    >
                      <option value="all">All Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  
                  {/* Payment Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Payment Status
                    </label>
                    <select
                      value={paymentStatusFilter}
                      onChange={(e) => setPaymentStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    >
                      <option value="all">All Payment Status</option>
                      <option value="pending">Pending</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                  
                  {/* Approval Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Approval Status
                    </label>
                    <select
                      value={approvalStatusFilter}
                      onChange={(e) => setApprovalStatusFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    >
                      <option value="all">All Approval Status</option>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                  </div>
                  
                  {/* Sort By */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Sort By
                    </label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    >
                      <option value="-createdAt">Newest First</option>
                      <option value="createdAt">Oldest First</option>
                      <option value="-totalAmount">Highest Amount</option>
                      <option value="totalAmount">Lowest Amount</option>
                      <option value="customerName">Customer Name A-Z</option>
                      <option value="-customerName">Customer Name Z-A</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content */}
          {activeTab === 'orders' ? (
            <div className="space-y-4">
              {orders.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📦</div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No preorders yet</h3>
                  <p className="text-gray-500 dark:text-slate-400">Customer preorders will appear here.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {orders.map((order) => (
                    <div key={order._id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg p-6">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
                        <div>
                          <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                            {order.customerName || 'Anonymous Customer'}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-slate-400">
                            Order ID: {order._id.slice(-8).toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-slate-400">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900 dark:text-slate-100">
                            ₱{order.totalAmount.toFixed(2)}
                          </p>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            order.status === 'pending' 
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : order.status === 'approved'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <h4 className="font-medium text-gray-900 dark:text-slate-100">Items:</h4>
                        {order.items.map((item, index) => (
                          <div key={index} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-slate-700 last:border-b-0">
                            <div>
                              <span className="text-gray-900 dark:text-slate-100">{item.product.name}</span>
                              <span className="text-gray-500 dark:text-slate-400 ml-2">x{item.quantity}</span>
                            </div>
                            <span className="text-gray-900 dark:text-slate-100">
                              ₱{(item.product.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      
                      {order.notes && (
                        <div className="mt-4 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                          <p className="text-sm text-gray-600 dark:text-slate-400">
                            <strong>Notes:</strong> {order.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📦</div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">No preorder products</h3>
                  <p className="text-gray-500 dark:text-slate-400">Products marked for preorder will appear here.</p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-2">
                    Go to Products page and enable "Available for Preorder" on products.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div key={product._id} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                      {product.imageUrl && (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-48 object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/images/products/default.svg'
                          }}
                        />
                      )}
                      <div className="p-4">
                        <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
                          {product.name}
                        </h3>
                        <p className="text-xl font-bold text-gray-900 dark:text-slate-100 mb-2">
                          ₱{product.price.toFixed(2)}
                        </p>
                        <div className="text-sm text-gray-500 dark:text-slate-400 space-y-1">
                          <p>Total Stock: {product.totalQuantity}</p>
                          <p>Available: {product.availableQuantity}</p>
                          <p>Reserved: {product.reservedQuantity}</p>
                        </div>
                        <div className="mt-3">
                          <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            Preorder Available
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
