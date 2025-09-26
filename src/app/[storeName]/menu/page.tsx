'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface Product {
  _id: string
  name: string
  price: number
  quantity: number
  availableForPreorder: boolean
  category?: string
  description?: string
  imageUrl?: string
}

interface Store {
  id: string
  name: string
}

export default function MenuPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [store, setStore] = useState<Store | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  
  const params = useParams()
  const router = useRouter()
  const storeName = params.storeName as string

  // Get unique categories
  const categories = ['all', ...Array.from(new Set(products.filter(p => p.category).map(p => p.category!)))]

  // Filter products
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  useEffect(() => {
    const fetchStoreAndProducts = async () => {
      try {
        setLoading(true)
        
        // Resolve store name to get store info
        const storeResponse = await fetch(`/api/stores/resolve/${encodeURIComponent(storeName)}`)
        if (storeResponse.ok) {
          const storeData = await storeResponse.json()
          
          // Check if store is accessible
          if (!storeData.accessible) {
            // Store is closed - redirect to closed page
            router.push(`/${storeName}/closed`)
            return
          }
          
          setStore({ id: storeData.id, name: storeData.name })
          
          // Fetch all products for the menu
          const productsResponse = await fetch(`/api/products/public?storeId=${storeData.id}`)
          if (productsResponse.ok) {
            const productsData = await productsResponse.json()
            setProducts(productsData.products || [])
          } else {
            setError('Failed to load menu')
          }
        } else {
          setError('Store not found')
        }
      } catch (err) {
        console.error('Error loading menu:', err)
        setError('Failed to load menu')
      } finally {
        setLoading(false)
      }
    }

    fetchStoreAndProducts()
  }, [storeName, router])

  // Real-time store status monitoring
  useEffect(() => {
    const checkStoreStatus = async () => {
      try {
        const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeName)}`, {
          // Prevent fetch from logging errors to console
          cache: 'no-cache'
        })
        
        if (response.ok) {
          const data = await response.json()
          if (!data.accessible) {
            console.log(`🏪 Store "${storeName}" has been closed - redirecting users`)
            // Store was just closed - redirect to closed page
            router.push(`/${storeName}/closed`)
          } else {
            // Store is still open - continue normally
            console.log(`✅ Store "${storeName}" is still open`)
          }
        } else {
          console.log(`⚠️ Store "${storeName}" status check returned: ${response.status}`)
        }
      } catch (error) {
        console.log(`⚠️ Unable to check store "${storeName}" status - network error`)
      }
    }

    // Start monitoring after initial load is complete and we have a store
    if (!loading && store && !error) {
      // Check immediately (silently for first check)
      const silentCheck = async () => {
        try {
          const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeName)}`, {
            cache: 'no-cache'
          })
          
          if (response.ok) {
            const data = await response.json()
            if (!data.accessible) {
              console.log(`🏪 Store "${storeName}" is closed - redirecting users`)
              router.push(`/${storeName}/closed`)
            }
          }
        } catch (error) {
          // Silent fail for initial check
        }
      }
      
      silentCheck()
      
      // Set up interval to check every 10 seconds with logging
      const interval = setInterval(checkStoreStatus, 10000)
      
      // Cleanup interval on unmount
      return () => clearInterval(interval)
    }
  }, [loading, store, error, storeName, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-slate-400">Loading menu...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => router.push(`/${storeName}/shop`)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go to Shop
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-lg border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                {store?.name}
              </h1>
              <span className="text-lg text-blue-600 dark:text-blue-400 font-medium">Menu</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/${storeName}/shop`)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Shop Now
              </button>
              <button
                onClick={() => router.push(`/${storeName}/orders`)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                My Orders
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filter Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              />
            </div>
            
            {/* Category Filter */}
            <div className="md:w-48">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
              >
                {categories.map(category => (
                  <option key={category} value={category}>
                    {category === 'all' ? 'All Categories' : category}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-slate-400 text-lg">
              {searchTerm || selectedCategory !== 'all' ? 'No items match your search.' : 'No menu items available.'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product._id}
                className="relative bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-gray-200 dark:border-slate-700 overflow-hidden hover:shadow-xl transition-shadow duration-300"
              >
                {/* Unavailable Watermark */}
                {product.quantity === 0 && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 z-10 flex items-center justify-center">
                    <div className="transform -rotate-12">
                      <span className="text-white text-2xl font-bold px-4 py-2 bg-red-600 rounded-lg shadow-lg">
                        UNAVAILABLE
                      </span>
                    </div>
                  </div>
                )}

                {/* Preorder Badge */}
                {product.availableForPreorder && (
                  <div className="absolute top-3 right-3 z-20">
                    <span className="bg-orange-500 text-white text-xs font-semibold px-2 py-1 rounded-full">
                      Preorder Available
                    </span>
                  </div>
                )}

                {/* Product Image */}
                <div className="aspect-w-16 aspect-h-12">
                  <img
                    src={product.imageUrl || '/images/products/default.svg'}
                    alt={product.name}
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = '/images/products/default.svg'
                    }}
                  />
                </div>

                {/* Product Info */}
                <div className="p-6">
                  <div className="mb-3">
                    <h3 className="font-semibold text-xl text-gray-900 dark:text-slate-100 mb-2">
                      {product.name}
                    </h3>
                    
                    {product.category && (
                      <span className="inline-block bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 text-xs font-medium px-2 py-1 rounded-full mb-2">
                        {product.category}
                      </span>
                    )}
                    
                    {product.description && (
                      <p className="text-gray-600 dark:text-slate-400 text-sm mb-3 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      ₱{product.price.toFixed(2)}
                    </span>
                    
                    <div className="text-right">
                      {product.quantity > 0 ? (
                        <span className="text-green-600 dark:text-green-400 text-sm font-medium">
                          Available
                        </span>
                      ) : (
                        <span className="text-red-600 dark:text-red-400 text-sm font-medium">
                          Out of Stock
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-600 dark:text-slate-400">
            © 2024 {store?.name}. All rights reserved.
          </p>
          <div className="mt-4 space-x-4">
            <button
              onClick={() => router.push(`/${storeName}/shop`)}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Start Shopping
            </button>
            <button
              onClick={() => router.push(`/${storeName}/preorder`)}
              className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300"
            >
              Preorder Items
            </button>
          </div>
        </div>
      </footer>
    </div>
  )
}
