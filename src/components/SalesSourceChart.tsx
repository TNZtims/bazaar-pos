'use client'

import { useState, useEffect } from 'react'

interface SalesSourceData {
  source: 'reservation' | 'walk-in'
  totalSales: number
  totalRevenue: number
  totalItems: number
  averageOrderValue: number
  salesPercentage: number
  revenuePercentage: number
  itemsPercentage: number
}

interface SalesSourceChartProps {
  startDate: string
  endDate: string
  sellers?: string[]
  paymentStatus?: string
  productId?: string
}

export default function SalesSourceChart({ startDate, endDate, sellers, paymentStatus, productId }: SalesSourceChartProps) {
  const [data, setData] = useState<SalesSourceData[]>([])
  const [totals, setTotals] = useState({
    totalSales: 0,
    totalRevenue: 0,
    totalItems: 0,
    averageOrderValue: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSalesSourceData()
  }, [startDate, endDate, sellers, paymentStatus, productId])

  const fetchSalesSourceData = async () => {
    setLoading(true)
    try {
      const startOfDay = new Date(startDate)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(endDate)
      endOfDay.setHours(23, 59, 59, 999)

      // Build query parameters
      const params = new URLSearchParams({
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString()
      })
      
      if (sellers && sellers.length > 0) params.append('sellers', sellers.join(','))
      if (paymentStatus && paymentStatus !== 'all') params.append('paymentStatus', paymentStatus)
      if (productId && productId !== 'all') params.append('productId', productId)

      const response = await fetch(`/api/reports/sales-source?${params.toString()}`)
      const result = await response.json()
      
      if (response.ok) {
        setData(result.sources || [])
        setTotals(result.totals || {})
      } else {
        console.error('Error fetching sales source data:', result.message)
      }
    } catch (error) {
      console.error('Error fetching sales source data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return `₱${amount.toFixed(2)}`
  }

  const getSourceIcon = (source: string) => {
    return source === 'reservation' ? '📱' : '🏪'
  }

  const getSourceLabel = (source: string) => {
    return source === 'reservation' ? 'Customer Reservations' : 'Walk-in Sales'
  }

  const getSourceColor = (source: string) => {
    return source === 'reservation' 
      ? 'from-blue-500 to-blue-600' 
      : 'from-green-500 to-green-600'
  }

  const getSourceBgColor = (source: string) => {
    return source === 'reservation' 
      ? 'bg-blue-50 dark:bg-blue-900/20' 
      : 'bg-green-50 dark:bg-green-900/20'
  }

  const getSourceTextColor = (source: string) => {
    return source === 'reservation' 
      ? 'text-blue-700 dark:text-blue-300' 
      : 'text-green-700 dark:text-green-300'
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
          Sales Source Breakdown
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-slate-400">
          No sales data available for the selected date range.
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          Sales Source Breakdown
        </h3>
        <div className="text-sm text-gray-500 dark:text-slate-400">
          {startDate === endDate ? startDate : `${startDate} to ${endDate}`}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg p-4 text-white">
          <div className="flex items-center">
            <span className="text-2xl mr-3">📊</span>
            <div>
              <p className="text-sm opacity-90">Total Sales</p>
              <p className="text-xl font-semibold">{totals.totalSales}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-lg p-4 text-white">
          <div className="flex items-center">
            <span className="text-2xl mr-3">💰</span>
            <div>
              <p className="text-sm opacity-90">Total Revenue</p>
              <p className="text-xl font-semibold">{formatCurrency(totals.totalRevenue)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-lg p-4 text-white">
          <div className="flex items-center">
            <span className="text-2xl mr-3">📦</span>
            <div>
              <p className="text-sm opacity-90">Total Items</p>
              <p className="text-xl font-semibold">{totals.totalItems}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-lg p-4 text-white">
          <div className="flex items-center">
            <span className="text-2xl mr-3">📈</span>
            <div>
              <p className="text-sm opacity-90">Avg Order Value</p>
              <p className="text-xl font-semibold">{formatCurrency(totals.averageOrderValue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Source Breakdown - Side by Side Modern Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sort data to ensure Customer Reservations (reservation) is on the left */}
        {[...data].sort((a, b) => a.source === 'reservation' ? -1 : 1).map((source) => (
          <div key={source.source} className="group relative overflow-hidden">
            {/* Modern Card with Gradient Border */}
            <div className={`relative bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 border-2 ${
              source.source === 'reservation' 
                ? 'border-blue-200 dark:border-blue-800 hover:border-blue-300 dark:hover:border-blue-700' 
                : 'border-green-200 dark:border-green-800 hover:border-green-300 dark:hover:border-green-700'
            }`}>
              
              {/* Gradient Background Accent */}
              <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 rounded-full blur-2xl ${
                source.source === 'reservation' ? 'bg-blue-500' : 'bg-green-500'
              }`}></div>
              
              {/* Header Section */}
              <div className="relative z-10 flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
                    source.source === 'reservation' 
                      ? 'bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/25' 
                      : 'bg-gradient-to-br from-green-500 to-green-600 shadow-green-500/25'
                  } shadow-lg`}>
                    {getSourceIcon(source.source)}
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-slate-100">
                      {getSourceLabel(source.source)}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-slate-400">
                      {source.salesPercentage}% of total sales
                    </p>
                  </div>
                </div>
                
                {/* Main Metric */}
                <div className="text-right">
                  <p className={`text-3xl font-bold ${getSourceTextColor(source.source)}`}>
                    {source.totalSales}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400">sales</p>
                </div>
              </div>
              
              {/* Revenue Display */}
              <div className="relative z-10 mb-6">
                <div className={`inline-flex items-center px-4 py-2 rounded-xl ${
                  source.source === 'reservation' 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                    : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                }`}>
                  <span className="text-lg font-semibold">
                    {formatCurrency(source.totalRevenue)}
                  </span>
                  <span className="ml-2 text-sm opacity-75">revenue</span>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="relative z-10 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-600 dark:text-slate-400">Sales Progress</span>
                  <span className={`text-sm font-semibold ${getSourceTextColor(source.source)}`}>
                    {source.salesPercentage}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`bg-gradient-to-r ${getSourceColor(source.source)} h-full rounded-full transition-all duration-1000 ease-out relative`}
                    style={{ width: `${source.salesPercentage}%` }}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                  </div>
                </div>
              </div>
              
              {/* Stats Grid */}
              <div className="relative z-10 grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Items Sold</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{source.totalItems}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{source.itemsPercentage}% of total</p>
                </div>
                
                <div className="text-center p-3 bg-gray-50 dark:bg-slate-700/50 rounded-xl">
                  <p className="text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1">Avg Order</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-slate-100">{formatCurrency(source.averageOrderValue)}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">per transaction</p>
                </div>
              </div>
              
              {/* Hover Effect Overlay */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 rounded-2xl ${
                source.source === 'reservation' ? 'bg-blue-500' : 'bg-green-500'
              }`}></div>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
