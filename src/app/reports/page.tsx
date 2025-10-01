'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'

interface DailyReport {
  date: string
  totalSales: number
  totalRevenue: number
  averageOrderValue: number
}

interface TopProduct {
  _id: string
  productName: string
  totalQuantitySold: number
  totalRevenue: number
  salesCount: number
}

interface ProductSalesData {
  _id: string
  productName: string
  currentStock: number
  price: number
  cost?: number
  category?: string
  totalQuantitySold: number
  totalRevenue: number
  salesCount: number
  profit: number
  profitMargin: number
  lastSaleDate?: string
}

interface Sale {
  _id: string
  finalAmount: number
  paymentMethod: string
  customerName?: string
  createdAt: string
  items: Array<{
    productName: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
}

export default function ReportsPage() {
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [allProducts, setAllProducts] = useState<ProductSalesData[]>([])
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [sortBy, setSortBy] = useState<'totalQuantitySold' | 'totalRevenue' | 'profit' | 'productName'>('totalQuantitySold')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  useEffect(() => {
    fetchReports()
  }, [selectedDate, dateFrom, dateTo])

  const fetchReports = async () => {
    setLoading(true)
    setProductsLoading(true)
    try {
      // Fetch daily report
      const dailyRes = await fetch(`/api/reports/daily?date=${selectedDate}`)
      const dailyData = await dailyRes.json()
      setDailyReport(dailyData)

      // Fetch top products (last 30 days) - keep for backward compatibility
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const topProductsRes = await fetch(`/api/reports/top-products?limit=10&startDate=${thirtyDaysAgo.toISOString()}`)
      const topProductsData = await topProductsRes.json()
      setTopProducts(topProductsData)

      // Fetch all products with sales data for selected date range
      const startOfDay = new Date(dateFrom)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(dateTo)
      endOfDay.setHours(23, 59, 59, 999)
      
      const allProductsRes = await fetch(`/api/reports/all-products?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`)
      const allProductsData = await allProductsRes.json()
      setAllProducts(allProductsData)

      // Fetch recent sales
      const salesRes = await fetch('/api/sales?limit=10')
      const salesData = await salesRes.json()
      setRecentSales(salesData.sales || [])

    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
      setProductsLoading(false)
    }
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₱0.00'
    }
    return `₱${amount.toFixed(2)}`
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleDateString()
  }

  // Get unique categories for filter
  const categories = ['all', ...new Set(allProducts.map(p => p.category).filter(Boolean))]

  // Sort and filter products
  const sortedAndFilteredProducts = allProducts
    .filter(product => filterCategory === 'all' || product.category === filterCategory)
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'productName':
          aValue = a.productName.toLowerCase()
          bValue = b.productName.toLowerCase()
          break
        case 'totalQuantitySold':
          aValue = a.totalQuantitySold
          bValue = b.totalQuantitySold
          break
        case 'totalRevenue':
          aValue = a.totalRevenue
          bValue = b.totalRevenue
          break
        case 'profit':
          aValue = a.profit
          bValue = b.profit
          break
        default:
          aValue = a.totalQuantitySold
          bValue = b.totalQuantitySold
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0
      }
    })

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  // Helper function to format date range for display
  const formatDateRange = () => {
    if (dateFrom === dateTo) {
      return dateFrom
    }
    return `${dateFrom} to ${dateTo}`
  }

  // Validation: ensure dateFrom is not after dateTo
  const handleDateFromChange = (value: string) => {
    setDateFrom(value)
    if (value > dateTo) {
      setDateTo(value)
    }
  }

  const handleDateToChange = (value: string) => {
    setDateTo(value)
    if (value < dateFrom) {
      setDateFrom(value)
    }
  }

  // Quick date range presets
  const setDateRangePreset = (days: number) => {
    const today = new Date()
    const startDate = new Date()
    startDate.setDate(today.getDate() - days + 1) // Include today
    
    setDateFrom(startDate.toISOString().split('T')[0])
    setDateTo(today.toISOString().split('T')[0])
  }

  const setThisMonth = () => {
    const today = new Date()
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
    
    setDateFrom(firstDay.toISOString().split('T')[0])
    setDateTo(today.toISOString().split('T')[0])
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Reports & Analytics</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Sales performance and insights</p>
          </div>
          
          {/* Date Range Selector */}
          <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Date From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => handleDateFromChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Date To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => handleDateToChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
              />
            </div>
            <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Daily Report Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
            </div>
            
            {/* Quick Date Range Presets */}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setDateRangePreset(1)}
                className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setDateRangePreset(7)}
                className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => setDateRangePreset(30)}
                className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={setThisMonth}
                className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
              >
                This Month
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-600 dark:text-slate-400">Loading reports...</div>
          </div>
        ) : (
          <>
            {/* Daily Report Cards */}
            {dailyReport && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">💰</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Sales</h3>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">{dailyReport.totalSales}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">📈</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Revenue</h3>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(dailyReport.totalRevenue)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">🛒</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Avg Order Value</h3>
                      <p className="text-2xl font-semibold text-gray-900 dark:text-slate-100">{formatCurrency(dailyReport.averageOrderValue)}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <span className="text-2xl">📅</span>
                    </div>
                    <div className="ml-4">
                      <h3 className="text-sm font-medium text-gray-500 dark:text-slate-400">Report Date</h3>
                      <p className="text-lg font-semibold text-gray-900 dark:text-slate-100">{selectedDate}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Enhanced Top Products Table - Full Width */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
              <div className="p-6 border-b border-gray-200 dark:border-slate-700">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">All Products Performance</h2>
                    <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                      Complete overview of all products with completed paid sales for {formatDateRange()}
                    </p>
                  </div>
                  
                  {/* Filters and Controls */}
                  <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
                    <select
                      value={filterCategory}
                      onChange={(e) => setFilterCategory(e.target.value)}
                      className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {categories.map(category => (
                        <option key={category} value={category}>
                          {category === 'all' ? 'All Categories' : category || 'Uncategorized'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                {productsLoading ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center gap-2 text-gray-600 dark:text-slate-400">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      Loading products data...
                    </div>
                  </div>
                ) : sortedAndFilteredProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-gray-500 dark:text-slate-400">
                      <div className="text-4xl mb-4">📦</div>
                      <p className="text-lg font-medium">No products found</p>
                      <p className="text-sm">Try adjusting your filters or add some products to your inventory</p>
                    </div>
                  </div>
                ) : (
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                    <thead className="bg-gray-50 dark:bg-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('productName')}
                            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-slate-200"
                          >
                            Product
                            {sortBy === 'productName' && (
                              <span className="text-blue-500">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Current Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('totalQuantitySold')}
                            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-slate-200"
                          >
                            Units Sold
                            {sortBy === 'totalQuantitySold' && (
                              <span className="text-blue-500">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Sales Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('totalRevenue')}
                            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-slate-200"
                          >
                            Revenue
                            {sortBy === 'totalRevenue' && (
                              <span className="text-blue-500">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          <button
                            onClick={() => handleSort('profit')}
                            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-slate-200"
                          >
                            Profit
                            {sortBy === 'profit' && (
                              <span className="text-blue-500">
                                {sortOrder === 'asc' ? '↑' : '↓'}
                              </span>
                            )}
                          </button>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Margin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                          Last Sale
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                      {sortedAndFilteredProducts.map((product, index) => (
                        <tr 
                          key={product._id} 
                          className={`hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${
                            product.totalQuantitySold === 0 ? 'opacity-75' : ''
                          }`}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mr-3 ${
                                product.totalQuantitySold > 0 
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                              }`}>
                            {index + 1}
                          </div>
                          <div>
                                <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                  {product.productName}
                          </div>
                                {product.totalQuantitySold === 0 && (
                                  <div className="text-xs text-red-500 dark:text-red-400">No sales</div>
                                )}
                        </div>
                      </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-400">
                            {product.category || 'Uncategorized'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              product.currentStock === 0 
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400'
                                : product.currentStock <= 5
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400'
                                : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                            }`}>
                              {product.currentStock} units
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                            {formatCurrency(product.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-slate-100">
                            {product.totalQuantitySold}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-400">
                            {product.salesCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-slate-100">
                            {formatCurrency(product.totalRevenue)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <span className={product.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {formatCurrency(product.profit)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={product.profitMargin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                              {formatPercentage(product.profitMargin)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-slate-400">
                            {formatDate(product.lastSaleDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              </div>

            {/* Recent Sales - Now Below Products Table */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Recent Sales</h2>
                
                {recentSales.length === 0 ? (
                  <p className="text-gray-500 dark:text-slate-400 text-center py-8">No recent sales</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-600 scrollbar-track-gray-100 dark:scrollbar-track-slate-700 pr-2">
                    <div className="space-y-3">
                      {recentSales.map((sale) => (
                        <div key={sale._id} className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-700">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-gray-900 dark:text-slate-100">{formatCurrency(sale.finalAmount)}</p>
                            <p className="text-sm text-gray-600 dark:text-slate-400">{formatDateTime(sale.createdAt)}</p>
                            </div>
                            <div className="text-right">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                sale.paymentMethod === 'cash' 
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                                  : sale.paymentMethod === 'card'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400'
                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400'
                              }`}>
                                {sale.paymentMethod}
                              </span>
                            </div>
                          </div>
                          
                          {sale.customerName && (
                            <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">Customer: {sale.customerName}</p>
                          )}
                          
                          <div className="text-sm text-gray-600 dark:text-slate-400">
                            <p className="font-medium">Items:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              {sale.items.map((item, index) => (
                                <li key={index}>
                                  {item.quantity}x {item.productName} - {formatCurrency(item.totalPrice)}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
