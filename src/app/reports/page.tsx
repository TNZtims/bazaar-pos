'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import SalesSourceChart from '@/components/SalesSourceChart'

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
  seller?: string
  totalQuantitySold: number
  totalRevenue: number
  salesCount: number
  profit: number
  profitMargin: number
  lastSaleDate?: string
}

interface Seller {
  name: string
  productCount: number
  lastUpdated: string
}

interface ProductOption {
  _id: string
  name: string
  category?: string
}


export default function ReportsPage() {
  const [dailyReport, setDailyReport] = useState<DailyReport | null>(null)
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [allProducts, setAllProducts] = useState<ProductSalesData[]>([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0])
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0])
  const [sortBy, setSortBy] = useState<'totalQuantitySold' | 'totalRevenue' | 'profit' | 'productName'>('totalQuantitySold')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  const [filterSeller, setFilterSeller] = useState<string[]>([])
  const [pendingSeller, setPendingSeller] = useState<string[]>([]) // Temporary state for dropdown selections
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>('all')
  const [filterProduct, setFilterProduct] = useState<string>('all')
  const [sellers, setSellers] = useState<Seller[]>([])
  const [productOptions, setProductOptions] = useState<ProductOption[]>([])
  const [sellersLoading, setSellersLoading] = useState(false)
  const [productOptionsLoading, setProductOptionsLoading] = useState(false)
  const [productsLoading, setProductsLoading] = useState(true)
  const [sellerDropdownOpen, setSellerDropdownOpen] = useState(false)

  useEffect(() => {
    fetchReports()
  }, [dateFrom, dateTo, filterSeller.join(','), filterPaymentStatus, filterProduct])

  useEffect(() => {
    fetchSellers()
    fetchProductOptions()
  }, [])

  // Initialize pending seller state when dropdown opens
  useEffect(() => {
    if (sellerDropdownOpen) {
      setPendingSeller([...filterSeller])
    }
  }, [sellerDropdownOpen, filterSeller])

  // Close dropdown when clicking outside and apply pending changes
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (sellerDropdownOpen && !target.closest('.seller-dropdown')) {
        handleSellerDropdownClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [sellerDropdownOpen, pendingSeller])

  const fetchReports = async () => {
    setLoading(true)
    setProductsLoading(true)
    try {
      // Calculate date range for reports
      const startOfDay = new Date(dateFrom)
      startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(dateTo)
      endOfDay.setHours(23, 59, 59, 999)

      // Fetch daily report for the selected date range
      const dailyRes = await fetch(`/api/reports/daily?startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`)
      const dailyData = await dailyRes.json()
      setDailyReport(dailyData)

      // Fetch top products for the selected date range
      const topProductsRes = await fetch(`/api/reports/top-products?limit=10&startDate=${startOfDay.toISOString()}&endDate=${endOfDay.toISOString()}`)
      const topProductsData = await topProductsRes.json()
      setTopProducts(topProductsData)

      // Build query parameters for all products
      const params = new URLSearchParams({
        startDate: startOfDay.toISOString(),
        endDate: endOfDay.toISOString()
      })
      
      if (filterSeller.length > 0) params.append('sellers', filterSeller.join(','))
      if (filterPaymentStatus !== 'all') params.append('paymentStatus', filterPaymentStatus)
      if (filterProduct !== 'all') params.append('productId', filterProduct)

      // Fetch all products with sales data for selected date range and filters
      const allProductsRes = await fetch(`/api/reports/all-products?${params.toString()}`)
      const allProductsData = await allProductsRes.json()
      setAllProducts(allProductsData)

    } catch (error) {
      console.error('Error fetching reports:', error)
    } finally {
      setLoading(false)
      setProductsLoading(false)
    }
  }

  const fetchSellers = async () => {
    setSellersLoading(true)
    try {
      const response = await fetch('/api/reports/sellers')
      const sellersData = await response.json()
      setSellers(sellersData)
    } catch (error) {
      console.error('Error fetching sellers:', error)
    } finally {
      setSellersLoading(false)
    }
  }

  const fetchProductOptions = async () => {
    setProductOptionsLoading(true)
    try {
      const response = await fetch('/api/reports/products-list')
      const productsData = await response.json()
      setProductOptions(productsData)
    } catch (error) {
      console.error('Error fetching product options:', error)
    } finally {
      setProductOptionsLoading(false)
    }
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

  // Debug: Log current filter state
  console.log('🔍 Table Filters:', {
    dateFrom,
    dateTo,
    filterSeller,
    filterPaymentStatus,
    filterProduct,
    filterCategory,
    searchTerm,
    totalProductsFromAPI: allProducts.length
  })

  // Sort and filter products
  // Note: allProducts is already filtered by API for sellers, paymentStatus, and productId
  // We apply additional client-side filters here (category and search)
  const sortedAndFilteredProducts = allProducts
    .filter(product => {
      // Category filter (client-side only)
      const categoryMatch = filterCategory === 'all' || product.category === filterCategory
      
      // Search filter (client-side only)
      const searchMatch = searchTerm === '' || 
        product.productName.toLowerCase().includes(searchTerm.toLowerCase())
      
      // Seller filter verification (should already be handled by API, but double-checking)
      const sellerMatch = filterSeller.length === 0 || 
        (product.seller && filterSeller.includes(product.seller))
      
      // Product filter verification (should already be handled by API, but double-checking)
      const productMatch = filterProduct === 'all' || product._id === filterProduct
      
      return categoryMatch && searchMatch && sellerMatch && productMatch
    })

  // Debug: Log filtering results
  console.log('🔍 Table Filtering Results:', {
    beforeFiltering: allProducts.length,
    afterFiltering: sortedAndFilteredProducts.length,
    filtersApplied: {
      category: filterCategory !== 'all',
      search: searchTerm !== '',
      seller: filterSeller.length > 0,
      product: filterProduct !== 'all'
    }
  })

  const finalSortedProducts = sortedAndFilteredProducts
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

  // Pagination logic
  const totalProducts = finalSortedProducts.length
  const totalPages = Math.ceil(totalProducts / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = Math.min(startIndex + itemsPerPage, totalProducts)
  const paginatedProducts = finalSortedProducts.slice(startIndex, endIndex)

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, filterCategory, filterSeller.length, filterPaymentStatus, filterProduct, sortBy, sortOrder])

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage)
    setCurrentPage(1) // Reset to first page when changing items per page
  }

  // Export functions
  const exportToCSV = (data: ProductSalesData[], filename: string) => {
    const headers = [
      'Product Name',
      'Category',
      'Seller',
      'Current Stock',
      'Price',
      'Units Sold',
      'Sales Count',
      'Revenue',
      'Profit',
      'Profit Margin (%)',
      'Last Sale Date'
    ]

    const csvContent = [
      headers.join(','),
      ...data.map(product => [
        `"${product.productName}"`,
        `"${product.category || 'Uncategorized'}"`,
        `"${product.seller || 'N/A'}"`,
        product.currentStock,
        product.price.toFixed(2),
        product.totalQuantitySold,
        product.salesCount,
        product.totalRevenue.toFixed(2),
        product.profit.toFixed(2),
        product.profitMargin.toFixed(1),
        product.lastSaleDate ? new Date(product.lastSaleDate).toLocaleDateString() : 'Never'
      ].join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleExportFiltered = () => {
    const filename = `products-report-${dateFrom}-to-${dateTo}-filtered.csv`
    exportToCSV(finalSortedProducts, filename)
  }

  const handleExportAll = async () => {
    try {
      // Fetch all products regardless of date range or filters
      // Make a clean API call without any parameters to bypass all filters
      const response = await fetch('/api/reports/all-products', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Explicitly don't pass any query parameters
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const allProductsData = await response.json()
      console.log(`📊 Export All: Fetched ${allProductsData.length} products (should be ALL products regardless of date filters)`)
      
      const filename = `all-products-complete-report.csv`
      exportToCSV(allProductsData, filename)
    } catch (error) {
      console.error('Error exporting all products:', error)
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

  // Handle seller dropdown close and apply changes
  const handleSellerDropdownClose = () => {
    setFilterSeller([...pendingSeller])
    setSellerDropdownOpen(false)
  }

  // Handle seller dropdown open
  const handleSellerDropdownOpen = () => {
    setPendingSeller([...filterSeller])
    setSellerDropdownOpen(true)
  }


  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Reports & Analytics</h1>
            <p className="mt-1 text-sm text-slate-400">Sales performance and insights</p>
          </div>
        </div>

        {/* Floating Loader Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-slate-800 rounded-2xl shadow-2xl p-8 mx-4 max-w-sm w-full border border-slate-700">
              {/* Modern Loading Spinner */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-16 h-16 border-4 border-slate-700 rounded-full animate-spin border-t-blue-600 dark:border-t-blue-400"></div>
                  <div className="absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping border-t-blue-600/20 dark:border-t-blue-400/20"></div>
                </div>
                
                {/* Loading Text */}
                <div className="mt-6 text-center">
                  <h3 className="text-lg font-semibold text-slate-100 mb-2">
                    Updating Reports
                  </h3>
                  <p className="text-sm text-slate-400">
                    Applying filters and refreshing data...
                  </p>
                </div>
                
                {/* Loading Progress Dots */}
                <div className="flex space-x-1 mt-4">
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                  <div className="w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sales Source Breakdown Chart */}
        <SalesSourceChart 
          startDate={dateFrom} 
          endDate={dateTo}
          sellers={filterSeller}
          paymentStatus={filterPaymentStatus}
          productId={filterProduct}
        />

        {/* Product Performance Controls */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-6">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-slate-100">Product Performance Controls</h3>
                <p className="text-sm text-slate-400">Filter and analyze product sales data</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {/* Date Range Filters */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Date From
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleDateFromChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Date To
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleDateToChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* Product Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Product
                  </label>
                  <select
                    value={filterProduct}
                    onChange={(e) => setFilterProduct(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={productOptionsLoading}
                  >
                    <option value="all">All Products</option>
                    {productOptions.map(product => (
                      <option key={product._id} value={product._id}>
                        {product.name} {product.category && `(${product.category})`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {categories.map(category => (
                      <option key={category} value={category}>
                        {category === 'all' ? 'All Categories' : category || 'Uncategorized'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Seller Filter - Modern Dropdown with Checkboxes */}
                <div className="relative seller-dropdown">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Sellers ({filterSeller.length} selected)
                  </label>
                  
                  {/* Dropdown Button */}
                  <button
                    onClick={() => sellerDropdownOpen ? handleSellerDropdownClose() : handleSellerDropdownOpen()}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                    disabled={sellersLoading}
                  >
                    <span className="truncate">
                      {filterSeller.length === 0 
                        ? 'Select sellers...' 
                        : filterSeller.length === 1 
                        ? filterSeller[0]
                        : `${filterSeller.length} sellers selected`
                      }
                      {sellerDropdownOpen && pendingSeller.length !== filterSeller.length && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                          ({pendingSeller.length} pending)
                        </span>
                      )}
                    </span>
                    <svg 
                      className={`w-4 h-4 transition-transform ${sellerDropdownOpen ? 'rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown Menu */}
                  {sellerDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-700 border border-slate-600 rounded-md shadow-lg max-h-60 overflow-auto">
                      {/* Header with Select All / Clear All */}
                      <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-600">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-medium text-slate-300">
                            {sellers.length} sellers available
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPendingSeller(sellers.map(s => s.name))}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                              disabled={sellersLoading || sellers.length === 0}
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => setPendingSeller([])}
                              className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
                              disabled={pendingSeller.length === 0}
                            >
                              Clear All
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Seller Options */}
                      <div className="py-1">
                        {sellers.map(seller => (
                          <label
                            key={seller.name}
                            className="flex items-center px-3 py-2 hover:bg-slate-600 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={pendingSeller.includes(seller.name)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPendingSeller(prev => [...prev, seller.name])
                                } else {
                                  setPendingSeller(prev => prev.filter(s => s !== seller.name))
                                }
                              }}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                            <div className="ml-3 flex-1">
                              <span className="text-sm text-slate-100 font-medium">
                                {seller.name}
                              </span>
                              <span className="text-xs text-slate-400 ml-1">
                                ({seller.productCount} products)
                              </span>
                            </div>
                          </label>
                        ))}
                        
                        {sellers.length === 0 && !sellersLoading && (
                          <div className="px-3 py-4 text-center text-sm text-slate-400">
                            No sellers found
                          </div>
                        )}
                        
                        {sellersLoading && (
                          <div className="px-3 py-4 text-center text-sm text-slate-400">
                            Loading sellers...
                          </div>
                        )}
                      </div>
                      
                      {/* Action Buttons */}
                      <div className="px-3 py-2 border-t border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-600 flex justify-between">
                        <button
                          onClick={() => {
                            setPendingSeller([...filterSeller])
                            setSellerDropdownOpen(false)
                          }}
                          className="px-3 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-slate-500 rounded"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSellerDropdownClose}
                          className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-700 rounded"
                          disabled={JSON.stringify(pendingSeller.sort()) === JSON.stringify(filterSeller.sort())}
                        >
                          Apply ({pendingSeller.length})
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Selected Sellers Display */}
                  {filterSeller.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {filterSeller.map(seller => (
                        <span
                          key={seller}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                        >
                          {seller}
                          <button
                            onClick={() => setFilterSeller(prev => prev.filter(s => s !== seller))}
                            className="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Payment Status Filter */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={filterPaymentStatus}
                    onChange={(e) => setFilterPaymentStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="pending">Pending</option>
                    <option value="overdue">Overdue</option>
                  </select>
                </div>
              </div>
            </div>

        {/* Enhanced Top Products Table - Full Width */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 relative">
          {/* Table Loading Overlay */}
          {productsLoading && (
            <div className="absolute inset-0 bg-slate-800/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
              <div className="bg-slate-800 rounded-xl shadow-lg p-6 border border-slate-700">
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-12 h-12 border-4 border-slate-700 rounded-full animate-spin border-t-blue-400"></div>
                    <div className="absolute inset-0 w-12 h-12 border-4 border-transparent rounded-full animate-pulse border-t-blue-400/30"></div>
                  </div>
                  
                  <div className="mt-4 text-center">
                    <p className="text-sm font-medium text-slate-100">
                      Updating Products
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Applying filters...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="p-6 border-b border-slate-700">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-100">All Products Performance</h2>
                <p className="mt-1 text-sm text-slate-400">
                  Complete overview of all products with completed paid sales for {formatDateRange()}
                </p>
              </div>
              
              {/* Search and Export Controls */}
              <div className="mt-4 sm:mt-0 flex flex-col sm:flex-row gap-3">
                    {/* Search Input */}
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-5 w-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search products..."
                        className="pl-10 pr-4 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-48"
                      />
                      {searchTerm && (
                        <button
                          onClick={() => setSearchTerm('')}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        >
                          <svg className="h-4 w-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Export Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleExportFiltered}
                        disabled={finalSortedProducts.length === 0}
                        className="px-3 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export Filtered ({finalSortedProducts.length})
                      </button>
                      <button
                        onClick={handleExportAll}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Export All Products
                      </button>
                    </div>
                  </div>
                </div>
              </div>

          <div className="overflow-x-auto">
            {totalProducts === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-400">
                  <div className="text-4xl mb-4">📦</div>
                  <p className="text-lg font-medium">No products found</p>
                  <p className="text-sm">Try adjusting your filters or add some products to your inventory</p>
                </div>
              </div>
            ) : (
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Category
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Seller
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Current Stock
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Sales Count
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
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
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Margin
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                          Last Sale
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-800 divide-y divide-slate-700">
                      {paginatedProducts.map((product, index) => (
                        <tr 
                          key={product._id} 
                          className={`hover:bg-slate-700 transition-colors ${
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
                            {startIndex + index + 1}
                          </div>
                          <div>
                                <div className="text-sm font-medium text-slate-100">
                                  {product.productName}
                          </div>
                                {product.totalQuantitySold === 0 && (
                                  <div className="text-xs text-red-500 dark:text-red-400">No sales</div>
                                )}
                        </div>
                      </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {product.category || 'Uncategorized'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {product.seller && product.seller !== 'N/A' ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400">
                                {product.seller}
                              </span>
                            ) : (
                              <span className="text-gray-400 dark:text-slate-500">No seller</span>
                            )}
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
                            {formatCurrency(product.price)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-100">
                            {product.totalQuantitySold}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {product.salesCount}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-100">
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
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                            {formatDate(product.lastSaleDate)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
            )}
          </div>

          {/* Pagination Controls */}
          {totalProducts > 0 && (
                <div className="px-6 py-4 border-t border-slate-700 bg-slate-700">
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                    <div className="text-sm text-slate-300">
                      Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{endIndex}</span> of{' '}
                      <span className="font-medium">{totalProducts}</span> products
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {/* Items per page selector */}
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-300">Show:</span>
                        <select
                          value={itemsPerPage}
                          onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                          className="px-2 py-1 border border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-100"
                        >
                          <option value={10}>10</option>
                          <option value={20}>20</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                      </div>

                      {/* Previous Button */}
                      <button
                        onClick={() => handlePageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-slate-400 bg-white dark:bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                                  : 'text-slate-400 bg-white dark:bg-slate-700 border-slate-600 hover:bg-slate-600'
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        
                        {totalPages > 5 && currentPage < totalPages - 2 && (
                          <>
                            <span className="text-slate-400 px-2">...</span>
                            <button
                              onClick={() => handlePageChange(totalPages)}
                              className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-slate-400 bg-white dark:bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 transition-colors"
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
                        className="relative inline-flex items-center px-3 py-2 text-sm font-medium text-slate-400 bg-white dark:bg-slate-700 border border-slate-600 rounded-md hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
      </div>
    </Layout>
  )
}
