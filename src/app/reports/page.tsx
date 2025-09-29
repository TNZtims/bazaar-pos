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
  const [recentSales, setRecentSales] = useState<Sale[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => {
    fetchReports()
  }, [selectedDate])

  const fetchReports = async () => {
    setLoading(true)
    try {
      // Fetch daily report
      const dailyRes = await fetch(`/api/reports/daily?date=${selectedDate}`)
      const dailyData = await dailyRes.json()
      setDailyReport(dailyData)

      // Fetch top products (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      const topProductsRes = await fetch(`/api/reports/top-products?limit=10&startDate=${thirtyDaysAgo.toISOString()}`)
      const topProductsData = await topProductsRes.json()
      setTopProducts(topProductsData)

      // Fetch recent sales
      const salesRes = await fetch('/api/sales?limit=10')
      const salesData = await salesRes.json()
      setRecentSales(salesData.sales || [])

    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const formatCurrency = (amount: number | undefined | null) => {
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '₱0.00'
    }
    return `₱${amount.toFixed(2)}`
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
          
          {/* Date Selector */}
          <div className="mt-4 sm:mt-0">
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
              Report Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            />
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products */}
              <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">Top Products (Last 30 Days)</h2>
                
                {topProducts.length === 0 ? (
                  <p className="text-gray-500 dark:text-slate-400 text-center py-8">No sales data available</p>
                ) : (
                  <div className="space-y-3">
                    {topProducts.map((product, index) => (
                      <div key={product._id} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-slate-600 last:border-b-0">
                        <div className="flex items-center">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full flex items-center justify-center text-sm font-semibold mr-3">
                            {index + 1}
                          </div>
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-slate-100">{product.productName}</h4>
                            <p className="text-sm text-gray-600 dark:text-slate-400">{product.salesCount} sales</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900 dark:text-slate-100">{product.totalQuantitySold} units</p>
                          <p className="text-sm text-gray-600 dark:text-slate-400">{formatCurrency(product.totalRevenue)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Sales */}
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
                              <p className="text-sm text-gray-600 dark:text-slate-400">{formatDate(sale.createdAt)}</p>
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
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}
