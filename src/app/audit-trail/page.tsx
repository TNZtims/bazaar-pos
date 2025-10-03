'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import LoadingOverlay from '@/components/LoadingOverlay'

interface AuditLog {
  _id: string
  productId: {
    _id: string
    name: string
    sku?: string
  }
  productName: string
  storeId: {
    _id: string
    storeName: string
  }
  storeName: string
  action: 'sale' | 'reservation' | 'restock' | 'adjustment' | 'preorder' | 'cancellation' | 'refund'
  quantityChange: number
  previousQuantity: number
  newQuantity: number
  reason?: string
  orderId?: string
  customerName?: string
  cashier?: string
  userId?: {
    _id: string
    name: string
    email: string
  }
  metadata?: {
    orderType?: 'sale' | 'preorder' | 'reservation'
    paymentStatus?: string
    customerPhone?: string
    customerEmail?: string
    notes?: string
  }
  createdAt: string
  updatedAt: string
}

export default function AuditTrailPage() {
  const { store, isAdmin } = useAuth()
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [totalLogs, setTotalLogs] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(25)
  
  // Filters
  const [storeFilter, setStoreFilter] = useState('')
  const [productFilter, setProductFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  
  // Available stores for admin
  const [availableStores, setAvailableStores] = useState<Array<{_id: string, storeName: string}>>([])

  const fetchAuditLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.append('page', currentPage.toString())
      params.append('limit', itemsPerPage.toString())
      
      if (storeFilter) {
        params.append('storeId', storeFilter)
      }
      
      if (productFilter) {
        params.append('productId', productFilter)
      }
      
      if (actionFilter) {
        params.append('action', actionFilter)
      }
      
      if (dateFrom) {
        params.append('startDate', dateFrom)
      }
      
      if (dateTo) {
        params.append('endDate', dateTo)
      }

      console.log('🔍 Audit Trail Page: Fetching with params:', params.toString())
      console.log('🔍 Audit Trail Page: User context:', { isAdmin, store: store?.id })

      const response = await fetch(`/api/audit-trail?${params}`)
      const data = await response.json()
      
      console.log('🔍 Audit Trail Page: API Response:', data)
      console.log('🔍 Audit Trail Page: Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch audit logs')
      }
      
      setAuditLogs(data.logs || [])
      setTotalPages(data.totalPages || 0)
      setTotalLogs(data.total || 0)
    } catch (error) {
      console.error('Error fetching audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStores = async () => {
    if (!isAdmin) return
    
    try {
      const response = await fetch('/api/stores/list')
      const data = await response.json()
      setAvailableStores(data.stores || [])
    } catch (error) {
      console.error('Error fetching stores:', error)
    }
  }

  useEffect(() => {
    fetchAuditLogs()
  }, [currentPage, itemsPerPage, storeFilter, productFilter, actionFilter, dateFrom, dateTo])

  useEffect(() => {
    fetchStores()
  }, [isAdmin])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'sale':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
      case 'reservation':
        return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
      case 'restock':
        return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
      case 'adjustment':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
      case 'preorder':
        return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400'
      case 'cancellation':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
      case 'refund':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400'
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-400'
    }
  }

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'sale':
        return '💰'
      case 'reservation':
        return '🔒'
      case 'restock':
        return '📦'
      case 'adjustment':
        return '⚖️'
      case 'preorder':
        return '📋'
      case 'cancellation':
        return '❌'
      case 'refund':
        return '↩️'
      default:
        return '📝'
    }
  }

  const clearFilters = () => {
    setStoreFilter('')
    setProductFilter('')
    setActionFilter('')
    setDateFrom('')
    setDateTo('')
    setCurrentPage(1)
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

  const startIndex = (currentPage - 1) * itemsPerPage + 1
  const endIndex = Math.min(currentPage * itemsPerPage, totalLogs)

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 px-4 sm:px-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-100">Audit Trail</h1>
              <p className="mt-1 text-sm text-slate-400">Track all product stock movements across stores</p>
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
            <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

                {/* Store Filter (Admin only) */}
                {isAdmin && (
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Store
                    </label>
                    <select
                      value={storeFilter}
                      onChange={(e) => setStoreFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">All Stores</option>
                      {availableStores.map((store) => (
                        <option key={store._id} value={store._id}>
                          {store.storeName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Action Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Action Type
                  </label>
                  <select
                    value={actionFilter}
                    onChange={(e) => setActionFilter(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All Actions</option>
                    <option value="sale">Sale</option>
                    <option value="reservation">Reservation</option>
                    <option value="restock">Restock</option>
                    <option value="adjustment">Adjustment</option>
                    <option value="preorder">Preorder</option>
                    <option value="cancellation">Cancellation</option>
                    <option value="refund">Refund</option>
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Quick Date Filters */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-600">
                <p className="text-sm font-medium text-slate-300 mb-2">Quick Date Filters:</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={setTodayFilter}
                    className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    onClick={setThisWeekFilter}
                    className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    This Week
                  </button>
                  <button
                    onClick={setThisMonthFilter}
                    className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    This Month
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Audit Logs Table */}
          <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700">
            {auditLogs.length === 0 && !loading ? (
              <div className="p-8 text-center text-slate-400">
                No audit logs found.
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                          Date & Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                          Product
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                          Store
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                          Action
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                          Quantity Change
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                          Stock Levels
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-300 uppercase tracking-wider">
                          Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-800 divide-y divide-slate-700">
                      {auditLogs.map((log) => (
                        <tr key={log._id} className="hover:bg-slate-700 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            {formatDate(log.createdAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            <div className="font-medium">{log.productName}</div>
                            {log.productId?.sku && (
                              <div className="text-slate-400 text-xs">SKU: {log.productId.sku}</div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            {log.storeName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                              <span className="mr-1">{getActionIcon(log.action)}</span>
                              {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`font-medium ${log.quantityChange > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                              {log.quantityChange > 0 ? '+' : ''}{log.quantityChange}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                            <div className="text-xs">
                              <div>Before: {log.previousQuantity}</div>
                              <div>After: {log.newQuantity}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-slate-100">
                            <div className="space-y-1">
                              {log.customerName && (
                                <div className="text-xs">
                                  <span className="font-medium">Customer:</span> {log.customerName}
                                </div>
                              )}
                              {log.cashier && (
                                <div className="text-xs">
                                  <span className="font-medium">Cashier:</span> {log.cashier}
                                </div>
                              )}
                              {log.reason && (
                                <div className="text-xs">
                                  <span className="font-medium">Reason:</span> {log.reason}
                                </div>
                              )}
                              {log.orderId && (
                                <div className="text-xs">
                                  <span className="font-medium">Order:</span> #{log.orderId.slice(-6)}
                                </div>
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
                  {auditLogs.map((log) => (
                    <div key={log._id} className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 bg-slate-700">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-medium text-slate-100">{log.productName}</p>
                          <p className="text-sm text-slate-400">{formatDate(log.createdAt)}</p>
                        </div>
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.action)}`}>
                          <span className="mr-1">{getActionIcon(log.action)}</span>
                          {log.action.charAt(0).toUpperCase() + log.action.slice(1)}
                        </span>
                      </div>
                      
                      <div className="space-y-1 mb-3">
                        <p className="text-sm text-slate-100">
                          Store: {log.storeName}
                        </p>
                        <p className="text-sm text-slate-100">
                          Quantity Change: <span className={`font-medium ${log.quantityChange > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {log.quantityChange > 0 ? '+' : ''}{log.quantityChange}
                          </span>
                        </p>
                        <p className="text-sm text-slate-100">
                          Stock: {log.previousQuantity} → {log.newQuantity}
                        </p>
                        
                        {log.customerName && (
                          <p className="text-sm text-slate-100">
                            Customer: {log.customerName}
                          </p>
                        )}
                        {log.cashier && (
                          <p className="text-sm text-slate-100">
                            Cashier: {log.cashier}
                          </p>
                        )}
                        {log.reason && (
                          <p className="text-sm text-slate-100">
                            Reason: {log.reason}
                          </p>
                        )}
                        {log.orderId && (
                          <p className="text-sm text-slate-100">
                            Order: #{log.orderId.slice(-6)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Pagination */}
          {totalLogs > 0 && (
            <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 px-6 py-4">
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="text-sm text-slate-300">
                  Showing <span className="font-medium">{startIndex}</span> to <span className="font-medium">{endIndex}</span> of{' '}
                  <span className="font-medium">{totalLogs.toLocaleString()}</span> audit logs
                </div>
                
                <div className="flex items-center gap-2">
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                  
                  {/* Previous Button */}
                  <button
                    onClick={() => setCurrentPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-slate-400 bg-slate-700 border border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
                            currentPage === pageNum
                              ? 'bg-blue-600 text-white border-blue-600'
                              : 'text-slate-400 bg-slate-700 border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-600'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-slate-400 bg-slate-700 border border-slate-600 rounded-md hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        </div>
      </Layout>

      {/* Loading Overlay */}
      <LoadingOverlay
        isVisible={loading}
        title="Loading Audit Trail"
        message="Fetching inventory change logs and audit data..."
        color="orange"
      />
    </ProtectedRoute>
  )
}
