'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useWebSocketInventory } from '@/hooks/useWebSocketInventory'

interface Product {
  _id: string
  name: string
  price: number
  quantity: number
  availableForPreorder: boolean
  description?: string
  category?: string
  imageUrl?: string
}

interface CartItem {
  product: Product
  quantity: number
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

export default function PreorderPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedQuantities, setSelectedQuantities] = useState<{[productId: string]: number}>({})
  const [storeId, setStoreId] = useState<string | null>(null)
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('')
  const [notes, setNotes] = useState('')
  
  // Real-time inventory updates via WebSocket
  const { 
    updates: inventoryUpdates, 
    isConnected: isWebSocketConnected,
    error: webSocketError
  } = useWebSocketInventory({
    storeId,
    enabled: !loading && !!storeId
  })
  
  const params = useParams()
  const router = useRouter()
  const storeName = params.storeName as string

  // Auto-switch to preorder tab when store is offline
  useEffect(() => {
    // This page is always for preorders, so no switching needed
  }, [])

  // Apply real-time inventory updates to products
  useEffect(() => {
    if (inventoryUpdates.length > 0) {
      setProducts(prevProducts => 
        prevProducts.map(product => {
          const update = inventoryUpdates.find(u => u.productId === product._id)
          if (update) {
            return {
              ...product,
              quantity: update.quantity ?? product.quantity
            }
          }
          return product
        })
      )
    }
  }, [inventoryUpdates])

  const fetchStoreInfo = async () => {
    try {
      const response = await fetch(`/api/stores/resolve/${storeName}`)
      if (response.ok) {
        const data = await response.json()
        setStore({ id: data.id, name: data.name })
        setStoreId(data.id)
      } else {
        setError('Store not found')
      }
    } catch (err) {
      setError('Failed to load store information')
    }
  }

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/customer/me', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (storeId && data.store.id !== storeId) {
          router.push(`/${storeName}/login`)
          return
        }
        setUser(data.user)
      } else {
        router.push(`/${storeName}/login`)
      }
    } catch (err) {
      router.push(`/${storeName}/login`)
    }
  }

  useEffect(() => {
    fetchStoreInfo()
  }, [storeName])

  useEffect(() => {
    if (storeId) {
      checkAuth()
    }
  }, [storeId, router, storeName])

  // Fetch preorder products
  useEffect(() => {
    const fetchProducts = async () => {
      if (!user || !storeId) return
      
      try {
        setLoading(true)
        const params = new URLSearchParams({
          search: search,
          preorderOnly: 'true' // Only get products available for preorder
        })
        
        const response = await fetch(`/api/products/public?${params}`, {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          setProducts(data.filter((p: Product) => p.availableForPreorder))
        } else {
          setError('Failed to load preorder products')
        }
      } catch (err) {
        setError('Failed to load products')
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [user, storeId, search])

  // Page refresh/exit protection with cart cleanup (for preorder cart)
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (cart.length > 0) {
        // Show confirmation prompt for preorder cart
        const message = 'You have items in your preorder cart. Are you sure you want to leave? All cart data will be lost.'
        
        // Save to localStorage for recovery (preorders don't reserve stock)
        localStorage.setItem('pendingPreorderCartCleanup', JSON.stringify(cart.map(item => ({
          productId: item.product._id,
          quantity: item.quantity,
          productName: item.product.name,
          productPrice: item.product.price
        }))))
        
        // Set returnValue to trigger browser confirmation
        event.returnValue = message
        
        // Return message for older browsers
        return message
      }
    }
    
    // Additional protection for page visibility changes
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && cart.length > 0) {
        // Save cart state to localStorage as backup
        localStorage.setItem('pendingPreorderCartCleanup', JSON.stringify(cart.map(item => ({
          productId: item.product._id,
          quantity: item.quantity,
          productName: item.product.name,
          productPrice: item.product.price
        }))))
      }
    }
    
    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Check for pending preorder cart recovery on page load
    const pendingPreorderCleanup = localStorage.getItem('pendingPreorderCartCleanup')
    if (pendingPreorderCleanup) {
      console.log('🔄 Found pending preorder cart - attempting recovery...')
      try {
        const savedCartItems = JSON.parse(pendingPreorderCleanup)
        
        // Ask user if they want to restore their preorder cart
        if (savedCartItems.length > 0) {
          const restore = window.confirm(
            `You had ${savedCartItems.length} item(s) in your preorder cart. Would you like to restore them?`
          )
          
          if (restore) {
            // Restore cart by fetching current product data
            ;(async () => {
              try {
                const restoredCart: CartItem[] = []
                
                for (const savedItem of savedCartItems) {
                  // Fetch current product data to ensure it's still available for preorder
                  const response = await fetch(`/api/products/public?search=${encodeURIComponent(savedItem.productName)}&preorderOnly=true`)
                  if (response.ok) {
                    const products = await response.json()
                    const product = products.find((p: Product) => p._id === savedItem.productId)
                    
                    if (product && product.availableForPreorder) {
                      restoredCart.push({
                        product,
                        quantity: savedItem.quantity
                      })
                    }
                  }
                }
                
                if (restoredCart.length > 0) {
                  setCart(restoredCart)
                  setSuccessMessage(`Restored ${restoredCart.length} item(s) to your preorder cart!`)
                  console.log(`✅ Restored ${restoredCart.length} preorder items`)
                } else {
                  console.log('❌ No preorder items could be restored (products may no longer be available)')
                }
              } catch (err) {
                console.error('Failed to restore preorder cart:', err)
              }
            })()
          }
        }
        
        // Clear the pending cleanup
        localStorage.removeItem('pendingPreorderCartCleanup')
        console.log('✅ Preorder cart cleanup completed')
      } catch (err) {
        console.error('Failed to parse pending preorder cart cleanup:', err)
        localStorage.removeItem('pendingPreorderCartCleanup')
      }
    }
    
    // Cleanup when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      // For preorders, we don't need to release stock, just clean up
      if (cart.length > 0) {
        console.log('🧹 Preorder component unmounting with cart items - saving to localStorage')
        localStorage.setItem('pendingPreorderCartCleanup', JSON.stringify(cart.map(item => ({
          productId: item.product._id,
          quantity: item.quantity,
          productName: item.product.name,
          productPrice: item.product.price
        }))))
      }
    }
  }, [cart])

  const addToCart = async (product: Product, quantity: number = 1) => {
    if (addingToCart === product._id) return
    
    setAddingToCart(product._id)
    setError('')
    setSuccessMessage('')
    
    try {
      const existingItem = cart.find(item => item.product._id === product._id)
      
      // Update local cart state (no stock reservation for preorders)
      if (existingItem) {
        setCart(cart.map(item =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        ))
        setSuccessMessage(`Added ${quantity} more x ${product.name} to preorder cart!`)
      } else {
        setCart([...cart, { product, quantity: quantity }])
        setSuccessMessage(`${quantity} x ${product.name} added to preorder cart!`)
      }
      
      // Reset selected quantity for this product
      setSelectedQuantities(prev => ({
        ...prev,
        [product._id]: 1
      }))
      
      setTimeout(() => setSuccessMessage(''), 3000)
      
    } catch (err) {
      setError('Failed to add item to cart. Please try again.')
    } finally {
      setAddingToCart(null)
    }
  }

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.product._id !== productId))
    } else {
      setCart(cart.map(item =>
        item.product._id === productId
          ? { ...item, quantity: quantity }
          : item
      ))
    }
  }

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0)
  }

  const handlePlacePreorder = async () => {
    if (cart.length === 0) {
      setError('Your preorder cart is empty')
      return
    }
    
    setSubmitting(true)
    setError('')
    
    try {
      const preorderItems = cart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity
      }))
      
      const response = await fetch('/api/preorders/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: preorderItems,
          estimatedDeliveryDate: estimatedDeliveryDate || undefined,
          notes: notes
        }),
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        setCart([])
        setEstimatedDeliveryDate('')
        setNotes('')
        
        // Clear any pending preorder cleanup since preorder was successfully placed
        localStorage.removeItem('pendingPreorderCartCleanup')
        
        setSuccessMessage(data.message || 'Preorder placed successfully!')
        
        // Redirect to My Orders after 2 seconds
        setTimeout(() => {
          router.push(`/${storeName}/orders`)
        }, 2000)
      } else {
        setError(data.message || 'Failed to place preorder')
      }
    } catch (err) {
      setError('Failed to place preorder. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Filter products based on search
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading preorder products...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-white dark:bg-slate-800 shadow-sm border-b border-gray-200 dark:border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/${storeName}/shop`)}
                className="text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200"
              >
                ← Back to Shop
              </button>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                Preorder from {store?.name}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/${storeName}/orders`)}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                My Orders
              </button>
              {user && (
                <span className="text-sm text-gray-600 dark:text-slate-400">
                  Welcome, {user.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Products Section */}
          <div className="lg:col-span-2">
            {/* Search and Status */}
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 mb-6">
              <div className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="Search preorder products..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                />
                {/* WebSocket Connection Status */}
                <div className="flex items-center space-x-2 px-3 py-2 bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <div 
                    className={`w-2 h-2 rounded-full ${
                      isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'
                    }`}
                    title={isWebSocketConnected ? 'Connected to real-time updates' : 'Disconnected from real-time updates'}
                  />
                  <span className={`text-sm ${
                    isWebSocketConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {isWebSocketConnected ? 'Live' : 'Offline'}
                  </span>
                </div>
              </div>
            </div>

            {/* Success/Error Messages */}
            {successMessage && (
              <div className="mb-4 p-4 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded-md">
                {successMessage}
              </div>
            )}
            
            {error && (
              <div className="mb-4 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md">
                {error}
              </div>
            )}

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredProducts.map((product) => (
                <div key={product._id} className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
                  {product.imageUrl && (
                    <div className="aspect-w-1 aspect-h-1 w-full h-48 bg-gray-200 dark:bg-slate-700">
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                      {product.name}
                    </h3>
                    
                    {product.description && (
                      <p className="text-sm text-gray-600 dark:text-slate-400 mb-3">
                        {product.description}
                      </p>
                    )}
                    
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        ${product.price.toFixed(2)}
                      </span>
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        Available for Preorder
                      </span>
                    </div>
                    
                    {/* Quantity Selector */}
                    <div className="flex items-center space-x-2 mb-4">
                      <button
                        onClick={() => setSelectedQuantities(prev => ({
                          ...prev,
                          [product._id]: Math.max(1, (prev[product._id] || 1) - 1)
                        }))}
                        className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-500"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={selectedQuantities[product._id] || 1}
                        onChange={(e) => setSelectedQuantities(prev => ({
                          ...prev,
                          [product._id]: Math.max(1, parseInt(e.target.value) || 1)
                        }))}
                        className="w-16 text-center py-1 border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                      />
                      <button
                        onClick={() => setSelectedQuantities(prev => ({
                          ...prev,
                          [product._id]: (prev[product._id] || 1) + 1
                        }))}
                        className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-500"
                      >
                        +
                      </button>
                    </div>
                    
                    <button
                      onClick={() => addToCart(product, selectedQuantities[product._id] || 1)}
                      disabled={addingToCart === product._id}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-2 px-4 rounded-md transition-colors"
                    >
                      {addingToCart === product._id ? 'Adding...' : 'Add to Preorder'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-slate-400 text-lg">
                  {search ? 'No preorder products found matching your search.' : 'No products available for preorder.'}
                </p>
              </div>
            )}
          </div>

          {/* Cart Section */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-6 sticky top-8">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Preorder Cart ({cart.length})
              </h2>
              
              {cart.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                  Your preorder cart is empty
                </p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.product._id} className="border-b border-gray-200 dark:border-slate-600 pb-4">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-slate-100">
                          {item.product.name}
                        </h4>
                        <button
                          onClick={() => updateCartQuantity(item.product._id, 0)}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                        >
                          ✕
                        </button>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)}
                            className="w-6 h-6 rounded bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm"
                          >
                            -
                          </button>
                          <span className="w-8 text-center">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)}
                            className="w-6 h-6 rounded bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-medium text-gray-900 dark:text-slate-100">
                          ${(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="space-y-4 pt-4">
                    {/* Estimated Delivery Date */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Estimated Delivery Date
                      </label>
                      <input
                        type="date"
                        value={estimatedDeliveryDate}
                        onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                      />
                    </div>
                    
                    {/* Notes */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Any special requests or notes for your preorder..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                      />
                    </div>
                    
                    <div className="border-t border-gray-200 dark:border-slate-600 pt-4">
                      <div className="flex justify-between items-center mb-4">
                        <span className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                          Total: ${getTotalAmount().toFixed(2)}
                        </span>
                      </div>
                      
                      <button
                        onClick={handlePlacePreorder}
                        disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-md transition-colors"
                      >
                        {submitting ? 'Placing Preorder...' : 'Place Preorder'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
