'use client'

import { useState, useEffect, useCallback } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import OrderEditModal from './OrderEditModal'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import { ConfirmationModal } from '@/components/Modal'
import { useWebSocketInventory } from '@/hooks/useWebSocketInventory'
import LoadingOverlay from '@/components/LoadingOverlay'
import WebSocketStatus from '@/components/WebSocketStatus'

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
  cashier?: string
  status: 'active' | 'completed' | 'cancelled' | 'refunded'
  createdAt: string
  items: SaleItem[]
}

export default function OrdersPage() {
  const { success, error } = useToast()
  const { store } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [exportLoading, setExportLoading] = useState(false)
  
  // Real-time order updates via WebSocket with error handling
  const { 
    isConnected: isWebSocketConnected,
    error: webSocketError,
    connectionQuality,
    reconnectAttempts
  } = useWebSocketInventory({
    storeId: store?.id || null,
    enabled: !!store?.id
  })

  // Log WebSocket status for debugging
  useEffect(() => {
    console.log('📡 Orders Page WebSocket Status:', {
      connected: isWebSocketConnected,
      error: webSocketError,
      storeId: store?.id
    })
  }, [isWebSocketConnected, webSocketError, store?.id])
  
  const [paymentLoading, setPaymentLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  
  // Debug: Monitor deleting state changes
  useEffect(() => {
    console.log('🔄 Deleting state changed:', deleting)
  }, [deleting])
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [searchInput, setSearchInput] = useState('') // Separate state for input field
  const [customerNameFilter, setCustomerNameFilter] = useState('')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all')
  const [productFilter, setProductFilter] = useState<string>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState<'createdAt' | 'finalAmount' | 'customerName'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [showFilters, setShowFilters] = useState(false)
  
  // Product options for filter
  const [productOptions, setProductOptions] = useState<Array<{_id: string, name: string}>>([])
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [totalOrders, setTotalOrders] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [paymentModal, setPaymentModal] = useState(false)
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
    notes: '',
    cashier: store?.selectedCashier || ''
  })

  // Update payment data when store/cashier changes
  useEffect(() => {
    if (store?.selectedCashier) {
      setPaymentData(prev => ({
        ...prev,
        cashier: store.selectedCashier || ''
      }))
    }
  }, [store?.selectedCashier])

  // Fetch products for filter dropdown
  const fetchProducts = useCallback(async () => {
    try {
      const response = await fetch('/api/products')
      const data = await response.json()
      console.log('🛍️ Orders: Fetched products for filter:', data.products?.length || 0)
      if (data.products) {
        const mappedProducts = data.products.map((product: any) => ({
          _id: product._id,
          name: product.name
        }))
        console.log('🛍️ Orders: Mapped products:', mappedProducts.slice(0, 3)) // Show first 3 for debugging
        setProductOptions(mappedProducts)
      }
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }, [])

  // Fetch products when component mounts
  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  // Define fetchOrders function before it's used in useEffect
  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('limit', itemsPerPage.toString())
      params.append('page', currentPage.toString())
      
      if (paymentStatusFilter !== 'all') {
        params.append('paymentStatus', paymentStatusFilter)
      }
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm)
      }
      
      if (customerNameFilter.trim()) {
        params.append('customerName', customerNameFilter)
      }
      
      if (productFilter !== 'all') {
        console.log('🔍 Orders: Adding product filter to API call:', productFilter)
        params.append('productId', productFilter)
      }
      
      if (dateFrom) {
        params.append('startDate', dateFrom)
      }
      
      if (dateTo) {
        params.append('endDate', dateTo)
      }
      
      if (sortBy && sortOrder) {
        params.append('sort', `${sortOrder === 'desc' ? '-' : ''}${sortBy}`)
      }

      const response = await fetch(`/api/sales?${params}`)
      const data = await response.json()
      
      setOrders(data.sales || [])
      setTotalOrders(data.total || 0)
      setTotalAmount(data.totalAmount || 0)
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setLoading(false)
    }
  }, [paymentStatusFilter, searchTerm, customerNameFilter, productFilter, dateFrom, dateTo, sortBy, sortOrder, currentPage, itemsPerPage])

  // Call fetchOrders when component mounts or dependencies change
  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  // Custom WebSocket listener for order updates (after fetchOrders is defined)
  useEffect(() => {
    if (!store?.id || !isWebSocketConnected) return
    
    // Import socket.io-client dynamically
    import('socket.io-client').then(({ io }) => {
      const socket = io()
      
      // Join store-specific room
      socket.emit('join-store', store.id)
      
      // Listen for new orders
      socket.on('order-created', (data: { customerName: string; totalAmount: number; itemCount: number }) => {
        console.log('📋 Orders Page: New order received via WebSocket:', data)
        
        // Show notification
        success(
          `New order from ${data.customerName}: ₱${data.totalAmount.toFixed(2)} (${data.itemCount} items)`,
          'New Order Received!'
        )
        
        // Refresh orders list
        fetchOrders()
      })
      
      return () => {
        socket.disconnect()
      }
    })
  }, [store?.id, isWebSocketConnected, success, fetchOrders])

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
    if (!selectedOrder || paymentData.amount <= 0 || paymentLoading) return

    // Ensure cashier is set from logged-in user
    const cashierName = store?.selectedCashier || paymentData.cashier
    if (!cashierName.trim()) {
      error('Cashier information is missing. Please log in again.', 'Authentication Error')
      return
    }

    setPaymentLoading(true)
    try {
      const response = await fetch(`/api/sales/${selectedOrder._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_payment',
          ...paymentData,
          cashier: cashierName
        })
      })

      if (response.ok) {
        success('Payment added successfully!', 'Payment Added')
        setPaymentModal(false)
        setSelectedOrder(null)
        setPaymentData({ amount: 0, method: 'cash', notes: '', cashier: store?.selectedCashier || '' })
        fetchOrders()
      } else {
        const errorData = await response.json()
        error(`Error: ${errorData.message}`, 'Payment Failed')
      }
    } catch (err) {
      console.error('Error adding payment:', err)
      error('Error adding payment', 'Payment Failed')
    } finally {
      setPaymentLoading(false)
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

  const handleDeleteOrder = async (orderId: string) => {
    const order = orders.find(o => o._id === orderId)
    if (!order) return

    // Prevent multiple clicks
    if (deleting === orderId) return

    // Calculate total items to be returned to stock
    const totalItems = order.items.reduce((sum, item) => sum + item.quantity, 0)
    const itemsList = order.items.map(item => `• ${item.productName} (${item.quantity} units)`).join('\n')

    showConfirmation(
      'Delete Order',
      `Are you sure you want to permanently delete this order?

📋 Order Details:
• Order ID: #${order._id.slice(-6)}
• Customer: ${order.customerName || 'Walk-in Customer'}
• Total Amount: ${formatCurrency(order.finalAmount)}
• Status: ${order.paymentStatus}

📦 Items to be returned to stock (${totalItems} total):
${itemsList}

⚠️ This action cannot be undone. All reserved quantities will be released back to available stock.`,
      async () => {
        // Close confirmation modal first
        closeConfirmation()
        
        // Set loading state
        setDeleting(orderId)
        console.log('🔄 Setting delete loading state for order:', orderId)
        
        try {
          const response = await fetch(`/api/sales/${orderId}`, {
            method: 'DELETE'
          })

          if (response.ok) {
            success(
              `Order deleted successfully! ${totalItems} items returned to stock.`, 
              'Order Deleted'
            )
            fetchOrders()
          } else {
            const errorData = await response.json()
            error(`Error: ${errorData.message}`, 'Delete Failed')
          }
        } catch (err) {
          console.error('Error deleting order:', err)
          error('Error deleting order', 'Delete Failed')
        } finally {
          console.log('✅ Clearing delete loading state for order:', orderId)
          setDeleting(null)
        }
      },
      'danger',
      'Delete Order',
      'Cancel'
    )
  }

  const openPaymentModal = (order: Order) => {
    setSelectedOrder(order)
    setPaymentData({ 
      amount: order.amountDue, 
      method: 'cash', 
      notes: '',
      cashier: '' 
    })
    setPaymentModal(true)
  }

  const openOrderEditModal = (order: Order) => {
    setSelectedOrder(order)
    setOrderEditModal(true)
  }

  const handleOrderUpdate = () => {
    // Refresh the orders list to show updated data
    fetchOrders()
    setSelectedOrder(null)
    console.log('Order updated, refreshing orders list')
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

  const handleSearch = () => {
    setSearchTerm(searchInput)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const clearFilters = () => {
    setPaymentStatusFilter('all')
    setSearchTerm('')
    setSearchInput('')
    setCustomerNameFilter('')
    setProductFilter('all')
    setDateFrom('')
    setDateTo('')
    setSortBy('createdAt')
    setSortOrder('desc')
  }

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0]
    setDateFrom(today)
    setDateTo(today)
  }

  const setThisWeekFilter = () => {
    const today = new Date()
    const weekStart = new Date(today.setDate(today.getDate() - today.getDay()))
    const weekEnd = new Date(today.setDate(today.getDate() - today.getDay() + 6))
    setDateFrom(weekStart.toISOString().split('T')[0])
    setDateTo(weekEnd.toISOString().split('T')[0])
  }

  const setThisMonthFilter = () => {
    const today = new Date()
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    setDateFrom(monthStart.toISOString().split('T')[0])
    setDateTo(monthEnd.toISOString().split('T')[0])
  }

  const handleExportOrders = async () => {
    try {
      setExportLoading(true)
      
      // Build the same parameters as fetchOrders but without pagination
      const params = new URLSearchParams()
      
      if (paymentStatusFilter !== 'all') {
        params.append('paymentStatus', paymentStatusFilter)
      }
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm)
      }
      
      if (customerNameFilter.trim()) {
        params.append('customerName', customerNameFilter)
      }
      
      if (productFilter !== 'all') {
        params.append('productId', productFilter)
      }
      
      if (dateFrom) {
        params.append('startDate', dateFrom)
      }
      
      if (dateTo) {
        params.append('endDate', dateTo)
      }
      
      if (sortBy && sortOrder) {
        params.append('sort', `${sortOrder === 'desc' ? '-' : ''}${sortBy}`)
      }

      // Add export flag to get all data without pagination
      params.append('export', 'true')

      console.log('📊 Orders: Exporting with filters:', Object.fromEntries(params))

      const response = await fetch(`/api/sales?${params}`)
      const data = await response.json()
      
      if (data.sales && data.sales.length > 0) {
        // Convert orders to CSV
        const csvData = convertOrdersToCSV(data.sales)
        
        // Create and download the file
        const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        
        // Generate filename with current date and filter info
        const now = new Date()
        const dateStr = now.toISOString().split('T')[0]
        const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-')
        let filename = `orders-export-${dateStr}-${timeStr}`
        
        // Add filter info to filename
        if (paymentStatusFilter !== 'all') filename += `-${paymentStatusFilter}`
        if (dateFrom && dateTo) filename += `-${dateFrom}-to-${dateTo}`
        else if (dateFrom) filename += `-from-${dateFrom}`
        else if (dateTo) filename += `-until-${dateTo}`
        
        link.setAttribute('download', `${filename}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        
        success(`Successfully exported ${data.sales.length} orders to CSV`, 'Export Complete')
      } else {
        error('No orders found to export', 'Export Failed')
      }
    } catch (err) {
      console.error('Error exporting orders:', err)
      error('Failed to export orders', 'Export Failed')
    } finally {
      setExportLoading(false)
    }
  }

  const convertOrdersToCSV = (orders: Order[]) => {
    // CSV Headers
    const headers = [
      'Order ID',
      'Date Created',
      'Customer Name',
      'Customer Phone',
      'Customer Email',
      'Items Count',
      'Product Names',
      'Quantities',
      'Subtotal (PHP)',
      'Tax (PHP)',
      'Discount (PHP)',
      'Final Amount (PHP)',
      'Amount Paid (PHP)',
      'Amount Due (PHP)',
      'Payment Status',
      'Payment Method',
      'Due Date',
      'Cashier',
      'Status',
      'Notes'
    ]

    // Helper function to format currency as number for CSV
    const formatCurrencyForCSV = (amount: number | undefined | null) => {
      if (amount === null || amount === undefined || isNaN(amount)) {
        return '0.00'
      }
      return amount.toFixed(2)
    }

    // Convert orders to CSV rows
    const rows = orders.map(order => {
      const productNames = order.items.map(item => item.productName).join('; ')
      const quantities = order.items.map(item => `${item.productName}: ${item.quantity}`).join('; ')
      
      return [
        `"${order._id}"`,
        `"${formatDate(order.createdAt)}"`,
        `"${order.customerName || 'Walk-in Customer'}"`,
        `"${order.customerPhone || ''}"`,
        `"${order.customerEmail || ''}"`,
        order.items.length,
        `"${productNames}"`,
        `"${quantities}"`,
        formatCurrencyForCSV(order.subtotal),
        formatCurrencyForCSV(order.tax),
        formatCurrencyForCSV(order.discount),
        formatCurrencyForCSV(order.finalAmount),
        formatCurrencyForCSV(order.amountPaid),
        formatCurrencyForCSV(order.amountDue),
        `"${isOverdue(order) ? 'Overdue' : order.paymentStatus}"`,
        `"${order.paymentMethod}"`,
        `"${order.dueDate ? formatDate(order.dueDate) : 'No due date'}"`,
        `"${order.cashier || 'N/A'}"`,
        `"${order.status}"`,
        `"${order.notes || ''}"`
      ]
    })

    // Combine headers and rows
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
    
    return csvContent
  }

  // Pagination helpers
  const totalPages = Math.ceil(totalOrders / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage + 1
  const endIndex = Math.min(currentPage * itemsPerPage, totalOrders)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [paymentStatusFilter, searchTerm, customerNameFilter, productFilter, dateFrom, dateTo, sortBy, sortOrder])

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 px-4 sm:px-0">
          {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Order Management</h1>
              <WebSocketStatus
                isConnected={isWebSocketConnected}
                connectionQuality={connectionQuality}
                error={webSocketError}
                reconnectAttempts={reconnectAttempts}
              />
            </div>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Manage orders, payments, and modifications</p>
          </div>
          
          {/* Quick Actions */}
          <div className="mt-4 sm:mt-0 flex flex-wrap gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2"
            >
              {showFilters ? (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                  Hide Filters
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  Show Filters
                </>
              )}
            </button>
            <button
              onClick={handleExportOrders}
              disabled={exportLoading || totalOrders === 0}
              className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {exportLoading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </>
              )}
            </button>
            <button
              onClick={clearFilters}
              className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear All
            </button>
          </div>
        </div>


        {/* Advanced Filters */}
        {showFilters && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl border-2 border-blue-200 dark:border-blue-700/50 p-6 backdrop-blur-sm bg-gradient-to-br from-blue-50/50 to-indigo-50/30 dark:from-slate-800/90 dark:to-slate-700/90 ring-1 ring-blue-100 dark:ring-blue-800/30">
            {/* Filter Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-blue-200/50 dark:border-blue-700/30">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg shadow-sm">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Advanced Filters</h3>
                <p className="text-sm text-gray-600 dark:text-slate-400">Refine your search with detailed criteria</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

              {/* Customer Name Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Customer Name
                </label>
                <input
                  type="text"
                  value={customerNameFilter}
                  onChange={(e) => setCustomerNameFilter(e.target.value)}
                  placeholder="Enter customer name..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Payment Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatusFilter}
                  onChange={(e) => setPaymentStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Payment Status</option>
                  <option value="pending">Pending Payment</option>
                  <option value="partial">Partial Payment</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                </select>
              </div>

              {/* Product Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Product
                </label>
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Products</option>
                  {productOptions.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date From */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Date From
                </label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date To */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Date To
                </label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as 'createdAt' | 'finalAmount' | 'customerName')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="createdAt">Date Created</option>
                  <option value="finalAmount">Order Amount</option>
                  <option value="customerName">Customer Name</option>
                </select>
              </div>

              {/* Sort Order */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Sort Order
                </label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
            </div>

            {/* Quick Date Filters */}
            <div className="mt-6 pt-6 border-t border-blue-200/50 dark:border-blue-700/30">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-300">Quick Date Filters:</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={setTodayFilter}
                  className="px-4 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200/50 dark:border-blue-800/30 font-medium"
                >
                  Today
                </button>
                <button
                  onClick={setThisWeekFilter}
                  className="px-4 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200/50 dark:border-blue-800/30 font-medium"
                >
                  This Week
                </button>
                <button
                  onClick={setThisMonthFilter}
                  className="px-4 py-2 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-all duration-200 shadow-sm hover:shadow-md border border-blue-200/50 dark:border-blue-800/30 font-medium"
                >
                  This Month
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modern Search Bar */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyPress={handleSearchKeyPress}
                placeholder="Search orders by ID, customer, product, cashier, amount, status, or any field..."
                className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-gray-500 dark:placeholder-slate-400"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput('')
                    setSearchTerm('')
                  }}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  <svg className="h-5 w-5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors flex items-center gap-2 font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-slate-400">
                {totalOrders > 0 ? `${startIndex}-${endIndex} of ${totalOrders}` : '0 orders'}
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value={5}>5 per page</option>
                <option value={10}>10 per page</option>
                <option value={20}>20 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
                <option value={100}>100 per page</option>
              </select>
            </div>
          </div>
          
          {/* Search Help Text */}
          {searchInput && (
            <div className="mt-2 text-xs text-gray-500 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">Search Tips:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                    <span>• Order ID (24-character)</span>
                    <span>• Customer name, phone, email</span>
                    <span>• Product names</span>
                    <span>• Cashier names</span>
                    <span>• Payment status (paid, pending, etc.)</span>
                    <span>• Payment method (cash, card, digital)</span>
                    <span>• Order status (active, completed, etc.)</span>
                    <span>• Amounts (₱100, 100.50)</span>
                    <span>• Dates (2024-01-15)</span>
                    <span>• Order notes</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Orders Table */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          {orders.length === 0 && !loading ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              No orders found.
            </div>
          ) : (
            <>
              {/* Dynamic Total Display */}
              <div className="px-6 py-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-600 border-b border-gray-200 dark:border-slate-600">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                        {totalOrders.toLocaleString()} Orders Found
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-slate-400">
                        {totalOrders === 1 ? '1 order' : `${totalOrders.toLocaleString()} orders`} 
                        {searchTerm || customerNameFilter || paymentStatusFilter !== 'all' || dateFrom || dateTo ? ' matching your filters' : ' total'}
                      </p>
                      <div className="flex items-center space-x-1 mt-1">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">
                          Total Amount: {formatCurrency(totalAmount)}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Filter Status Indicators */}
                  <div className="flex items-center space-x-2">
                    {(searchTerm || customerNameFilter || paymentStatusFilter !== 'all' || dateFrom || dateTo) && (
                      <div className="flex items-center space-x-1 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                        <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Filtered</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-1 px-3 py-1.5 bg-green-100 dark:bg-green-900/30 rounded-full">
                      <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <span className="text-xs font-medium text-green-700 dark:text-green-300">
                        Page {currentPage} of {Math.ceil(totalOrders / itemsPerPage)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Order Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                        Products & Qty
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
                        Cashier
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
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 dark:text-slate-100 max-w-xs">
                            {order.items.slice(0, 3).map((item, index) => (
                              <div key={index} className="flex justify-between items-center py-1">
                                <span className="truncate mr-2" title={item.productName}>
                                  {item.productName}
                                </span>
                                <span className="text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                                  ×{item.quantity}
                                </span>
                              </div>
                            ))}
                            {order.items.length > 3 && (
                              <div className="text-gray-500 dark:text-slate-400 text-xs mt-1">
                                +{order.items.length - 3} more items
                              </div>
                            )}
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
                          {order.cashier || 'N/A'}
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
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openPaymentModal(order)
                                }}
                                className="inline-flex items-center px-3 py-1.5 border border-green-300 dark:border-green-600 text-xs font-medium rounded-md text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                                title="Add Payment"
                              >
                                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Pay
                              </button>
                            )}
                            {(order.status === 'active' || order.paymentStatus !== 'paid') && order.paymentStatus !== 'partial' && (
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
                            {order.status === 'active' && order.paymentStatus !== 'partial' && (
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
                            {(order.paymentStatus === 'pending' || order.status === 'active') && order.paymentStatus !== 'partial' && (
                              <button
                                onClick={() => handleDeleteOrder(order._id)}
                                disabled={deleting === order._id}
                                className={`inline-flex items-center px-3 py-1.5 border text-xs font-medium rounded-md transition-colors ${
                                  deleting === order._id 
                                    ? 'border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-not-allowed' 
                                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-900/40 disabled:opacity-50 disabled:cursor-not-allowed'
                                }`}
                                title={deleting === order._id ? "Processing deletion..." : "Delete Order"}
                              >
                                {deleting === order._id ? (
                                  <>
                                    <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                    Delete
                                  </>
                                )}
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
                        Cashier: {order.cashier || 'N/A'}
                      </p>
                      
                      {/* Products Preview for Mobile */}
                      <div className="text-sm text-gray-900 dark:text-slate-100">
                        <p className="font-medium mb-1">Products:</p>
                        <div className="space-y-1 pl-2">
                          {order.items.slice(0, 2).map((item, index) => (
                            <div key={index} className="flex justify-between items-center">
                              <span className="truncate mr-2" title={item.productName}>
                                {item.productName}
                              </span>
                              <span className="text-blue-600 dark:text-blue-400 font-medium whitespace-nowrap">
                                ×{item.quantity}
                              </span>
                            </div>
                          ))}
                          {order.items.length > 2 && (
                            <div className="text-gray-500 dark:text-slate-400 text-xs">
                              +{order.items.length - 2} more items
                            </div>
                          )}
                        </div>
                      </div>
                      
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
                          onClick={(e) => {
                            e.stopPropagation()
                            openPaymentModal(order)
                          }}
                          className="inline-flex items-center px-2.5 py-1.5 border border-green-300 dark:border-green-600 text-xs font-medium rounded text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                        >
                          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Pay
                        </button>
                      )}
                      {(order.status === 'active' || order.paymentStatus !== 'paid') && order.paymentStatus !== 'partial' && (
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
                      {(order.paymentStatus === 'pending' || order.status === 'active') && order.paymentStatus !== 'partial' && (
                        <button
                          onClick={() => handleDeleteOrder(order._id)}
                          disabled={deleting === order._id}
                          className={`inline-flex items-center px-2.5 py-1.5 border text-xs font-medium rounded transition-colors ${
                            deleting === order._id 
                              ? 'border-blue-300 dark:border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 cursor-not-allowed' 
                              : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-900/40 disabled:opacity-50 disabled:cursor-not-allowed'
                          }`}
                        >
                          {deleting === order._id ? (
                            <>
                              <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Processing...
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Modern Pagination */}
        {totalOrders > 0 && (
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 px-6 py-4">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-700 dark:text-slate-300">
                Showing <span className="font-medium">{startIndex}</span> to <span className="font-medium">{endIndex}</span> of{' '}
                <span className="font-medium">{totalOrders}</span> orders
              </div>
              
              <div className="flex items-center gap-2">
                {/* Previous Button */}
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => handlePageChange(pageNum)}
                        className={`relative inline-flex items-center px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-700 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {totalPages > 5 && currentPage < totalPages - 2 && (
                    <>
                      <span className="text-gray-500 dark:text-slate-400 px-2">...</span>
                      <button
                        onClick={() => handlePageChange(totalPages)}
                        className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 transition-colors"
                      >
                        {totalPages}
                      </button>
                    </>
                  )}
                </div>

                {/* Next Button */}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-700 border border-gray-300 dark:border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {selectedOrder && !paymentModal && !orderEditModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="backdrop-blur-md bg-white/95 dark:bg-slate-900/95 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200/50 dark:border-slate-700/50 mx-4">
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
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="backdrop-blur-md bg-white/95 dark:bg-slate-900/95 rounded-xl shadow-2xl max-w-md w-full border border-slate-200/50 dark:border-slate-700/50 mx-4">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Add Payment</h3>
                  <button
                    onClick={() => {
                      setPaymentModal(false)
                      setSelectedOrder(null)
                    }}
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
                        {selectedOrder.payments.map((payment: Payment, index: number) => (
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
                        onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value as 'cash' | 'card' | 'digital' })}
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
                        Cashier
                      </label>
                      <div className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-gray-50 dark:bg-slate-600 text-gray-900 dark:text-slate-100">
                        <div className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-medium">{store?.selectedCashier || 'Unknown Cashier'}</span>
                          <span className="text-xs text-gray-500 dark:text-slate-400">(Logged in)</span>
                        </div>
                      </div>
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
                    disabled={paymentLoading || paymentData.amount <= 0 || paymentData.amount > selectedOrder.amountDue || selectedOrder.amountDue <= 0}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer flex items-center"
                  >
                    {paymentLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Processing...
                      </>
                    ) : selectedOrder.amountDue <= 0 ? (
                      'Fully Paid'
                    ) : (
                      `Add ₱${paymentData.amount.toFixed(2)} Payment`
                    )}
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
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={closeConfirmation}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
          type={confirmModal.type}
          confirmText={confirmModal.confirmText}
          cancelText={confirmModal.cancelText}
        />

        {/* Main Loading Overlay */}
        <LoadingOverlay
          isVisible={loading}
          title="Loading Orders"
          message="Fetching order data with applied filters..."
          color="blue"
        />

        {/* Export Loading Overlay */}
        <LoadingOverlay
          isVisible={exportLoading}
          title="Exporting Orders"
          message="Generating CSV file with filtered data..."
          color="green"
        />
      </div>
    </Layout>
    </ProtectedRoute>
  )
}
