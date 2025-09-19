'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import OrderEditModal from './OrderEditModal'
import { useToast } from '@/contexts/ToastContext'

interface SaleItem {
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Payment {
  amount: number
  method: 'cash' | 'card' | 'digital'
  date: string
  notes?: string
}

interface Order {
  _id: string
  finalAmount: number
  subtotal: number
  tax: number
  discount: number
  paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue'
  paymentMethod: 'cash' | 'card' | 'digital' | 'mixed'
  amountPaid: number
  amountDue: number
  payments: Payment[]
  dueDate?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  notes?: string
  status: 'active' | 'completed' | 'cancelled' | 'refunded'
  createdAt: string
  items: SaleItem[]
}

export default function OrdersPage() {
  const { success, error } = useToast()
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [paymentModal, setPaymentModal] = useState(false)
  const [editModal, setEditModal] = useState(false)
  const [orderEditModal, setOrderEditModal] = useState(false)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean
    title: string
    message: string
    confirmText: string
    cancelText: string
    onConfirm: () => void
    type: 'warning' | 'danger'
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    onConfirm: () => {},
    type: 'warning'
  })
  
  const [paymentData, setPaymentData] = useState({
    amount: 0,
    method: 'cash' as 'cash' | 'card' | 'digital',
    notes: ''
  })

  useEffect(() => {
    fetchOrders()
  }, [filterStatus])

  const fetchOrders = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('limit', '100')
      
      if (filterStatus !== 'all') {
        params.append('paymentStatus', filterStatus)
      }

      const response = await fetch(`/api/sales?${params}`)
      const data = await response.json()
      
      // Show all orders, but you can filter by payment status using the dropdown
      const allOrders = data.sales || []
      
      setOrders(allOrders)
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₱0.00'
    }
    return `₱${amount.toFixed(2)}`
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
      case 'partial':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
      case 'overdue':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400'
    }
  }

  const handleAddPayment = async () => {
    if (!selectedOrder || paymentData.amount <= 0) return

    try {
      const response = await fetch(`/api/sales/${selectedOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_payment',
          ...paymentData
        })
      })

      if (response.ok) {
        success('Payment added successfully!', 'Payment Added')
        setPaymentModal(false)
        setPaymentData({ amount: 0, method: 'cash', notes: '' })
        fetchOrders()
      } else {
        const errorData = await response.json()
        error(`Error: ${errorData.message}`, 'Payment Failed')
      }
    } catch (err) {
      console.error('Error adding payment:', err)
      error('Error adding payment', 'Payment Failed')
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    const order = orders.find(o => o._id === orderId)
    if (!order) return

    showConfirmation(
      'Cancel Order',
      `Are you sure you want to cancel this order?\n\nOrder #${order._id.slice(-6)}\nCustomer: ${order.customerName || 'Walk-in Customer'}\nTotal: ${formatCurrency(order.finalAmount)}\n\nThis will restore all product quantities back to inventory.`,
      async () => {
        try {
          const response = await fetch(`/api/sales/${orderId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'cancel' })
          })

          if (response.ok) {
            closeConfirmation()
            success('Order cancelled successfully!', 'Order Cancelled')
            fetchOrders()
          } else {
            const errorData = await response.json()
            error(`Error: ${errorData.message}`, 'Cancel Failed')
          }
        } catch (err) {
          console.error('Error cancelling order:', err)
          error('Error cancelling order', 'Cancel Failed')
        }
      },
      'danger',
      'Cancel Order',
      'Keep Order'
    )
  }

  const openPaymentModal = (order: Order) => {
    setSelectedOrder(order)
    setPaymentData({ 
      amount: order.amountDue, 
      method: 'cash', 
      notes: '' 
    })
    setPaymentModal(true)
  }

  const openOrderEditModal = (order: Order) => {
    setSelectedOrder(order)
    setOrderEditModal(true)
  }

  const handleOrderUpdate = () => {
    fetchOrders()
    setSelectedOrder(null)
  }

  const showConfirmation = (
    title: string,
    message: string,
    onConfirm: () => void,
    type: 'warning' | 'danger' = 'warning',
    confirmText: string = 'Confirm',
    cancelText: string = 'Cancel'
  ) => {
    setConfirmModal({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      onConfirm,
      type
    })
  }

  const closeConfirmation = () => {
    setConfirmModal(prev => ({ ...prev, isOpen: false }))
  }

  const isOverdue = (order: Order) => {
    if (!order.dueDate || order.paymentStatus === 'paid') return false
    return new Date(order.dueDate) < new Date()
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Order Management</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Manage orders, payments, and modifications</p>
          </div>
          
          {/* Filter */}
          <div className="mt-4 sm:mt-0">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">All Orders</option>
              <option value="pending">Pending Payment</option>
              <option value="partial">Partial Payment</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600 dark:text-slate-400">Loading orders...</div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              No orders found.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Order Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {orders.map((order) => (
                      <tr key={order._id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-slate-100">
                            <div className="font-medium">#{order._id.slice(-6)}</div>
                            <div className="text-gray-500 dark:text-slate-400">{formatDate(order.createdAt)}</div>
                            <div className="text-gray-500 dark:text-slate-400">{order.items.length} items</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                          <div>{order.customerName || 'Walk-in Customer'}</div>
                          {order.customerPhone && (
                            <div className="text-gray-500 dark:text-slate-400 text-xs">{order.customerPhone}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="text-gray-900 dark:text-slate-100 font-medium">
                            Total: {formatCurrency(order.finalAmount)}
                          </div>
                          <div className="text-green-600 dark:text-green-400">
                            Paid: {formatCurrency(order.amountPaid)}
                          </div>
                          {order.amountDue > 0 && (
                            <div className="text-orange-600 dark:text-orange-400">
                              Due: {formatCurrency(order.amountDue)}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(isOverdue(order) ? 'overdue' : order.paymentStatus)}`}>
                            {isOverdue(order) ? 'Overdue' : order.paymentStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                          {order.dueDate ? formatDate(order.dueDate) : 'No due date'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="inline-flex items-center px-3 py-1.5 border border-blue-300 dark:border-blue-600 text-xs font-medium rounded-md text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                              title="View Details"
                            >
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              View
                            </button>
                            {order.amountDue > 0 && (
                              <button
                                onClick={() => openPaymentModal(order)}
                                className="inline-flex items-center px-3 py-1.5 border border-green-300 dark:border-green-600 text-xs font-medium rounded-md text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                                title="Add Payment"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Pay
                              </button>
                            )}
                            {(order.status === 'active' || order.paymentStatus !== 'paid') && (
                              <button
                                onClick={() => openOrderEditModal(order)}
                                className="inline-flex items-center px-3 py-1.5 border border-purple-300 dark:border-purple-600 text-xs font-medium rounded-md text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                                title="Edit Order"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Edit
                              </button>
                            )}
                            {order.status === 'active' && (
                              <button
                                onClick={() => handleCancelOrder(order._id)}
                                className="inline-flex items-center px-3 py-1.5 border border-red-300 dark:border-red-600 text-xs font-medium rounded-md text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                                title="Cancel Order"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4 p-4">
                {orders.map((order) => (
                  <div key={order._id} className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-700">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-slate-100">#{order._id.slice(-6)}</p>
                        <p className="text-sm text-gray-600 dark:text-slate-400">{formatDate(order.createdAt)}</p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(isOverdue(order) ? 'overdue' : order.paymentStatus)}`}>
                        {isOverdue(order) ? 'Overdue' : order.paymentStatus}
                      </span>
                    </div>
                    
                    <div className="space-y-1 mb-3">
                      <p className="text-sm text-gray-900 dark:text-slate-100">
                        Customer: {order.customerName || 'Walk-in Customer'}
                      </p>
                      <p className="text-sm text-gray-900 dark:text-slate-100">
                        Total: {formatCurrency(order.finalAmount)}
                      </p>
                      <p className="text-sm text-green-600 dark:text-green-400">
                        Paid: {formatCurrency(order.amountPaid)}
                      </p>
                      {order.amountDue > 0 && (
                        <p className="text-sm text-orange-600 dark:text-orange-400">
                          Due: {formatCurrency(order.amountDue)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="inline-flex items-center px-2.5 py-1.5 border border-blue-300 dark:border-blue-600 text-xs font-medium rounded text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        View
                      </button>
                      {order.amountDue > 0 && (
                        <button
                          onClick={() => openPaymentModal(order)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-green-300 dark:border-green-600 text-xs font-medium rounded text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Pay
                        </button>
                      )}
                      {(order.status === 'active' || order.paymentStatus !== 'paid') && (
                        <button
                          onClick={() => openOrderEditModal(order)}
                          className="inline-flex items-center px-2.5 py-1.5 border border-purple-300 dark:border-purple-600 text-xs font-medium rounded text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Order Details Modal */}
        {selectedOrder && !paymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Order Details</h3>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Order Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Order ID</label>
                      <p className="text-sm text-gray-900 dark:text-slate-100 font-mono">#{selectedOrder._id.slice(-8)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Date Created</label>
                      <p className="text-sm text-gray-900 dark:text-slate-100">{formatDate(selectedOrder.createdAt)}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Customer</label>
                      <p className="text-sm text-gray-900 dark:text-slate-100">{selectedOrder.customerName || 'Walk-in Customer'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300">Status</label>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(isOverdue(selectedOrder) ? 'overdue' : selectedOrder.paymentStatus)}`}>
                        {isOverdue(selectedOrder) ? 'Overdue' : selectedOrder.paymentStatus}
                      </span>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Items</label>
                    <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                      <table className="min-w-full">
                        <thead className="bg-gray-50 dark:bg-slate-700">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300">Product</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300">Qty</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300">Price</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-slate-300">Total</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                          {selectedOrder.items.map((item, index) => (
                            <tr key={index}>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-slate-100">{item.productName}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-slate-100">{item.quantity}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-slate-100">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-4 py-2 text-sm text-gray-900 dark:text-slate-100">{formatCurrency(item.totalPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Payment History */}
                  {selectedOrder.payments.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Payment History</label>
                      <div className="space-y-2">
                        {selectedOrder.payments.map((payment, index) => (
                          <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {formatCurrency(payment.amount)} - {payment.method}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-slate-400">
                                {formatDate(payment.date)}
                              </div>
                              {payment.notes && (
                                <div className="text-xs text-gray-600 dark:text-slate-400">{payment.notes}</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Financial Summary */}
                  <div className="border-t border-gray-200 dark:border-slate-600 pt-4 space-y-2">
                    <div className="flex justify-between text-sm text-gray-900 dark:text-slate-100">
                      <span>Subtotal:</span>
                      <span>{formatCurrency(selectedOrder.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-900 dark:text-slate-100">
                      <span>Tax:</span>
                      <span>{formatCurrency(selectedOrder.tax)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-900 dark:text-slate-100">
                      <span>Discount:</span>
                      <span>-{formatCurrency(selectedOrder.discount)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold border-t border-gray-200 dark:border-slate-600 pt-2 text-gray-900 dark:text-slate-100">
                      <span>Total:</span>
                      <span>{formatCurrency(selectedOrder.finalAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                      <span>Amount Paid:</span>
                      <span>{formatCurrency(selectedOrder.amountPaid)}</span>
                    </div>
                    {selectedOrder.amountDue > 0 && (
                      <div className="flex justify-between text-sm text-orange-600 dark:text-orange-400 font-medium">
                        <span>Amount Due:</span>
                        <span>{formatCurrency(selectedOrder.amountDue)}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  {selectedOrder.amountDue > 0 && (
                    <button
                      onClick={() => openPaymentModal(selectedOrder)}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 cursor-pointer"
                    >
                      Add Payment
                    </button>
                  )}
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-400 dark:hover:bg-slate-500 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {paymentModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Add Payment</h3>
                  <button
                    onClick={() => setPaymentModal(false)}
                    className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 cursor-pointer"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Payment Summary */}
                  <div className="bg-slate-700 rounded-lg p-4">
                    <h4 className="font-medium text-slate-100 mb-3">Payment Summary</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-300">Total Amount:</span>
                        <span className="text-slate-100">{formatCurrency(selectedOrder.finalAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-300">Amount Paid:</span>
                        <span className="text-green-400">{formatCurrency(selectedOrder.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-600 pt-2">
                        <span className="text-slate-300 font-medium">Amount Due:</span>
                        <span className="text-orange-400 font-medium">{formatCurrency(selectedOrder.amountDue)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Previous Payments */}
                  {selectedOrder.payments && selectedOrder.payments.length > 0 && (
                    <div>
                      <h4 className="font-medium text-slate-100 mb-2">Payment History</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {selectedOrder.payments.map((payment: any, index: number) => (
                          <div key={index} className="flex justify-between items-center text-sm bg-slate-700 rounded p-2">
                            <div>
                              <span className="text-slate-100">{formatCurrency(payment.amount)}</span>
                              <span className="text-slate-400 ml-2">({payment.method})</span>
                              {payment.notes && <span className="text-slate-500 ml-2">- {payment.notes}</span>}
                            </div>
                            <span className="text-slate-400 text-xs">
                              {new Date(payment.date).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Payment Form */}
                  {selectedOrder.amountDue > 0 ? (
                    <div>
                      <h4 className="font-medium text-slate-100 mb-3">Add New Payment</h4>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                            Payment Amount (₱)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={selectedOrder.amountDue}
                            value={paymentData.amount}
                            onChange={(e) => setPaymentData({ ...paymentData, amount: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            Maximum: {formatCurrency(selectedOrder.amountDue)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-4 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <div className="text-green-800 dark:text-green-400 font-medium">
                        ✓ Order Fully Paid
                      </div>
                      <div className="text-sm text-green-600 dark:text-green-500 mt-1">
                        This order has been completely paid off.
                      </div>
                    </div>
                  )}

                  {/* Quick Payment Buttons */}
                  {selectedOrder.amountDue > 0 && (
                    <div>
                      <div className="text-sm text-slate-400 mb-2">Quick Amounts:</div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => setPaymentData({ ...paymentData, amount: selectedOrder.amountDue })}
                          className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 cursor-pointer"
                        >
                          Full Amount (₱{selectedOrder.amountDue.toFixed(2)})
                        </button>
                        {selectedOrder.amountDue >= 100 && (
                          <button
                            onClick={() => setPaymentData({ ...paymentData, amount: Math.min(100, selectedOrder.amountDue) })}
                            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 cursor-pointer"
                          >
                            ₱100
                          </button>
                        )}
                        {selectedOrder.amountDue >= 500 && (
                          <button
                            onClick={() => setPaymentData({ ...paymentData, amount: Math.min(500, selectedOrder.amountDue) })}
                            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 cursor-pointer"
                          >
                            ₱500
                          </button>
                        )}
                        {selectedOrder.amountDue >= 1000 && (
                          <button
                            onClick={() => setPaymentData({ ...paymentData, amount: Math.min(1000, selectedOrder.amountDue) })}
                            className="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 cursor-pointer"
                          >
                            ₱1000
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedOrder.amountDue > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Payment Method
                      </label>
                      <select
                        value={paymentData.method}
                        onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                      >
                        <option value="cash">Cash</option>
                        <option value="card">Card</option>
                        <option value="digital">Digital</option>
                      </select>
                    </div>
                  )}

                  {selectedOrder.amountDue > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={paymentData.notes}
                        onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Optional payment notes..."
                      />
                    </div>
                  )}

                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setPaymentModal(false)}
                    className="px-4 py-2 bg-gray-300 dark:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-400 dark:hover:bg-slate-500 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddPayment}
                    disabled={paymentData.amount <= 0 || paymentData.amount > selectedOrder.amountDue || selectedOrder.amountDue <= 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {selectedOrder.amountDue <= 0 ? 'Fully Paid' : `Add ₱${paymentData.amount.toFixed(2)} Payment`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Edit Modal */}
        <OrderEditModal
          order={selectedOrder}
          isOpen={orderEditModal}
          onClose={() => {
            setOrderEditModal(false)
            setSelectedOrder(null)
          }}
          onUpdate={handleOrderUpdate}
        />

        {/* Confirmation Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
            <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center mb-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  confirmModal.type === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
                }`}>
                  {confirmModal.type === 'danger' ? (
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  )}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {confirmModal.title}
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line">
                  {confirmModal.message}
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={closeConfirmation}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`px-4 py-2 text-white rounded-md transition-colors ${
                    confirmModal.type === 'danger' 
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
    </ProtectedRoute>
  )
}
