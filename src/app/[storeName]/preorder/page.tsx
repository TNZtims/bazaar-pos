'use client'

import React, { useState, useEffect } from 'react'
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

interface Store {
  _id: string
  name: string
  description?: string
  isActive: boolean
}

export default function PreorderPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [store, setStore] = useState<Store | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedQuantities, setSelectedQuantities] = useState<{[productId: string]: number}>({})
  
  const [orderData, setOrderData] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: ''
  })
  
  const params = useParams()
  const router = useRouter()
  const storeName = params.storeName as string

  // Real-time inventory updates via WebSocket
  const { 
    updates: inventoryUpdates, 
    deletedProducts,
    cartUpdates,
    isConnected: isWebSocketConnected,
    error: webSocketError,
    broadcastCartUpdate
  } = useWebSocketInventory({
    storeId: store?._id || null,
    enabled: !!store?._id
  })

  useEffect(() => {
    fetchStore()
    fetchProducts()
  }, [storeName])

  // Apply real-time inventory updates to products
  useEffect(() => {
    if (inventoryUpdates.length > 0) {
      console.log('Received inventory updates:', inventoryUpdates)
      setProducts(prevProducts => 
        prevProducts.map(product => {
          const update = inventoryUpdates.find(u => u.productId === product._id)
          if (update) {
            console.log(`Updating product ${product.name} from ${product.quantity} to ${update.quantity}`)
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

  // Debug WebSocket connection
  useEffect(() => {
    console.log('WebSocket connection status:', isWebSocketConnected)
    console.log('WebSocket error:', webSocketError)
    console.log('Store ID for WebSocket:', store?._id)
  }, [isWebSocketConnected, webSocketError, store])

  const fetchStore = async () => {
    try {
      const response = await fetch(`/api/stores/public/${storeName}`)
      if (response.ok) {
        const storeData = await response.json()
        setStore(storeData)
      } else {
        setError('Store not found')
      }
    } catch (err) {
      setError('Failed to load store information')
    }
  }

    const fetchProducts = async () => {
      try {
        setLoading(true)
      const response = await fetch(`/api/products/public?store=${storeName}&preorderOnly=true`)
        if (response.ok) {
          const data = await response.json()
        setProducts(data.products || [])
        } else {
        setError('Failed to load products')
        }
      } catch (err) {
        setError('Failed to load products')
      } finally {
        setLoading(false)
      }
    }
    
  const addToCart = async (product: Product, quantity: number) => {
    // Check if product has sufficient quantity
    if (product.quantity < quantity) {
      setError(`Insufficient quantity for ${product.name}. Available: ${product.quantity}`)
      setTimeout(() => setError(''), 3000)
      return
    }
    
    try {
      console.log('Attempting to reserve quantity:', quantity, 'for product:', product.name, 'store:', store?._id)
      
      // Reserve the quantity in the database immediately
      const response = await fetch('/api/preorders/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeId: store?._id,
          productId: product._id,
          quantity: quantity,
          action: 'reserve'
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('Reservation API error:', response.status, errorData)
        setError(errorData.message || 'Failed to reserve product quantity')
        setTimeout(() => setError(''), 3000)
        return
      }
      
      const result = await response.json()
      console.log('Reservation API success:', result)
      
      // Update cart only after successful reservation
      const existingItemIndex = cart.findIndex(item => item.product._id === product._id)
      
      if (existingItemIndex >= 0) {
        const newCart = [...cart]
        newCart[existingItemIndex].quantity += quantity
        setCart(newCart)
      } else {
        setCart([...cart, { product, quantity }])
      }
      
      // Broadcast the cart update via WebSocket
      broadcastCartUpdate(product._id, 'reserve', quantity)
      
      // Reset selected quantity
      setSelectedQuantities(prev => ({ ...prev, [product._id]: 1 }))
      
      // Show success message
      setSuccessMessage(`${quantity} x ${product.name} added to preorder!`)
      setTimeout(() => setSuccessMessage(''), 3000)
      
    } catch (err) {
      setError('Failed to add item to preorder. Please try again.')
      setTimeout(() => setError(''), 3000)
    }
  }

  const removeFromCart = async (productId: string) => {
    // Find the cart item to get its quantity
    const cartItem = cart.find(item => item.product._id === productId)
    
    if (!cartItem) return
    
    try {
      // Release the quantity back to the database
      const response = await fetch('/api/preorders/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeId: store?._id,
          productId: productId,
          quantity: cartItem.quantity,
          action: 'release'
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to release product quantity')
        setTimeout(() => setError(''), 3000)
        return
      }
      
      // Remove from cart only after successful release
      setCart(cart.filter(item => item.product._id !== productId))
      
      // Broadcast the cart update via WebSocket
      broadcastCartUpdate(productId, 'release', cartItem.quantity)
      
    } catch (err) {
      setError('Failed to remove item from preorder. Please try again.')
      setTimeout(() => setError(''), 3000)
    }
  }

  const updateCartQuantity = async (productId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(productId)
      return
    }
    
    // Find the current cart item and product
    const cartItem = cart.find(item => item.product._id === productId)
    const product = products.find(p => p._id === productId)
    
    if (!cartItem || !product) return
    
    const quantityDifference = newQuantity - cartItem.quantity
    
    if (quantityDifference === 0) return // No change needed
    
    try {
      // Reserve or release the quantity difference in the database
      const action = quantityDifference > 0 ? 'reserve' : 'release'
      const absQuantityDifference = Math.abs(quantityDifference)
      
      // Check if we have enough quantity available for the increase
      if (quantityDifference > 0 && product.quantity < absQuantityDifference) {
        setError(`Cannot update quantity. Maximum available: ${product.quantity + cartItem.quantity}`)
        setTimeout(() => setError(''), 3000)
        return
      }
      
      const response = await fetch('/api/preorders/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeId: store?._id,
          productId: productId,
          quantity: absQuantityDifference,
          action: action
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to update product quantity')
        setTimeout(() => setError(''), 3000)
        return
      }
      
      // Update the cart only after successful reservation/release
      setCart(cart.map(item =>
        item.product._id === productId
        ? { ...item, quantity: newQuantity }
          : item
      ))
      
      // Broadcast the cart update via WebSocket
      broadcastCartUpdate(productId, action, absQuantityDifference)
      
    } catch (err) {
      setError('Failed to update quantity. Please try again.')
      setTimeout(() => setError(''), 3000)
    }
  }

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0)
  }

  const submitPreorder = async () => {
    if (cart.length === 0) {
      setError('Please add items to your preorder')
      return
    }
    
    if (!orderData.customerName.trim()) {
      setError('Please enter your name')
      return
    }
    
    setSubmitting(true)
    setError('')
    
    try {
      const response = await fetch('/api/preorders/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeId: store?._id,
          customerName: orderData.customerName,
          customerPhone: orderData.customerPhone,
          customerEmail: orderData.customerEmail,
          notes: orderData.notes,
          items: cart.map(item => ({
            productId: item.product._id,
            quantity: item.quantity
          }))
        })
      })
      
      if (response.ok) {
        const result = await response.json()
        setSuccessMessage('Preorder submitted successfully! We will contact you soon.')
        setCart([])
        setOrderData({ customerName: '', customerPhone: '', customerEmail: '', notes: '' })
        setShowOrderModal(false)
        
        // Quantities are already reserved in database - no need to refresh
        
        setTimeout(() => {
          setSuccessMessage('')
          router.push(`/${storeName}/menu`)
        }, 3000)
      } else {
        const errorData = await response.json()
        setError(errorData.message || 'Failed to submit preorder')
        
        // If preorder fails, release all reserved quantities back to the database
        for (const item of cart) {
          try {
            await fetch('/api/preorders/reserve', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                storeId: store?._id,
                productId: item.product._id,
                quantity: item.quantity,
                action: 'release'
              })
            })
            broadcastCartUpdate(item.product._id, 'release', item.quantity)
          } catch (err) {
            console.error('Failed to release reserved quantity:', err)
          }
        }
      }
    } catch (err) {
      setError('Failed to submit preorder. Please try again.')
      
      // If there's an error, release all reserved quantities back to the database
      for (const item of cart) {
        try {
          await fetch('/api/preorders/reserve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              storeId: store?._id,
              productId: item.product._id,
              quantity: item.quantity,
              action: 'release'
            })
          })
          broadcastCartUpdate(item.product._id, 'release', item.quantity)
        } catch (err) {
          console.error('Failed to release reserved quantity:', err)
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase()) ||
    (product.description && product.description.toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-slate-400">Loading preorder items...</p>
        </div>
      </div>
    )
  }

  if (!store) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">Store Not Found</h1>
          <p className="text-gray-600 dark:text-slate-400 mb-4">The store you're looking for doesn't exist or is inactive.</p>
          <button
            onClick={() => router.push('/')}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            Go Home
          </button>
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
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                {store.name} - Preorders
              </h1>
              {store.description && (
                <p className="text-sm text-gray-600 dark:text-slate-400">{store.description}</p>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push(`/${storeName}/menu`)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Back to Menu
              </button>
              
              {cart.length > 0 && (
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 flex items-center space-x-2"
                >
                  <span>Preorder ({cart.length})</span>
                  <span className="bg-orange-700 px-2 py-1 rounded text-sm">
                    ₱{getTotalAmount().toFixed(2)}
                </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-300 rounded-md">
            {error}
                </div>
        )}

            {successMessage && (
          <div className="mb-6 p-4 bg-green-100 dark:bg-green-900 border border-green-400 dark:border-green-600 text-green-700 dark:text-green-300 rounded-md">
                {successMessage}
              </div>
            )}
            
        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search preorder items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
              </div>

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
                    
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xl font-bold text-gray-900 dark:text-slate-100">
                    ₱{product.price.toFixed(2)}
                      </span>
                  <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                    Preorder Available
                      </span>
                    </div>
                    
                    {/* Availability Display */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-600 dark:text-slate-400">Available:</span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        {product.quantity} in stock
                      </span>
                    </div>
                    
                    {/* Quantity Selector */}
                <div className="flex items-center space-x-2 mb-3">
                  <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                    Qty:
                  </label>
                  <div className="flex items-center border border-gray-300 dark:border-slate-600 rounded-md">
                      <button
                      onClick={() => {
                        const current = selectedQuantities[product._id] || 1
                        if (current > 1) {
                          setSelectedQuantities(prev => ({
                          ...prev,
                            [product._id]: current - 1
                          }))
                        }
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-slate-600"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                      </button>
                    <span className="px-3 py-1 text-sm font-medium min-w-[3rem] text-center">
                      {selectedQuantities[product._id] || 1}
                    </span>
                      <button
                      onClick={() => {
                        const current = selectedQuantities[product._id] || 1
                        const maxQuantity = product.quantity || 0
                        if (current < maxQuantity) {
                          setSelectedQuantities(prev => ({
                            ...prev,
                            [product._id]: current + 1
                          }))
                        }
                      }}
                      disabled={!product.quantity || (selectedQuantities[product._id] || 1) >= product.quantity}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                      </button>
                  </div>
                    </div>
                    
                    <button
                      onClick={() => addToCart(product, selectedQuantities[product._id] || 1)}
                      disabled={!product.quantity || product.quantity === 0}
                  className="w-full py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {product.quantity === 0 ? 'Out of Stock' : 'Add to Preorder'}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-slate-400 text-lg">
              No preorder items available.
                </p>
              </div>
            )}
      </main>

      {/* Preorder Modal */}
      {showOrderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="backdrop-blur-md bg-white/95 dark:bg-slate-900/95 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200/50 dark:border-slate-700/50">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Complete Preorder</h3>
                        <button
                  onClick={() => setShowOrderModal(false)}
                  className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                        >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                        </button>
                      </div>
                      
              {/* Cart Items */}
              <div className="mb-6">
                <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-3">Preorder Items</h4>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.product._id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-slate-800 rounded-lg">
                      <div className="flex-1">
                        <h5 className="font-medium text-gray-900 dark:text-slate-100">{item.product.name}</h5>
                        <p className="text-sm text-gray-600 dark:text-slate-400">₱{item.product.price.toFixed(2)} each</p>
                      </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
                          >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                          </svg>
                          </button>
                        <span className="px-2 py-1 bg-white dark:bg-slate-700 rounded text-sm font-medium min-w-[2rem] text-center">
                          {item.quantity}
                        </span>
                          <button
                            onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product._id)}
                          className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          </button>
                        </div>
                      <div className="ml-4 text-right">
                        <p className="font-medium text-gray-900 dark:text-slate-100">
                          ₱{(item.product.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-slate-600">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-gray-900 dark:text-slate-100">Total:</span>
                    <span className="text-xl font-bold text-orange-600 dark:text-orange-400">
                      ₱{getTotalAmount().toFixed(2)}
                        </span>
                      </div>
                    </div>
              </div>

              {/* Customer Information */}
              <div className="space-y-4 mb-6">
                <h4 className="font-medium text-gray-900 dark:text-slate-100">Contact Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={orderData.customerName}
                    onChange={(e) => setOrderData({ ...orderData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    required
                  />
                </div>
                
                    <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Phone Number
                      </label>
                      <input
                    type="tel"
                    value={orderData.customerPhone}
                    onChange={(e) => setOrderData({ ...orderData, customerPhone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    
                    <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Email
                      </label>
                  <input
                    type="email"
                    value={orderData.customerEmail}
                    onChange={(e) => setOrderData({ ...orderData, customerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={orderData.notes}
                    onChange={(e) => setOrderData({ ...orderData, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="Special requests or additional information..."
                  />
                </div>
                      </div>
                      
              {/* Actions */}
              <div className="flex space-x-4">
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="flex-1 py-2 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  Continue Shopping
                </button>
                      <button
                  onClick={submitPreorder}
                        disabled={submitting}
                  className="flex-1 py-2 px-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                      >
                  {submitting ? 'Submitting...' : 'Submit Preorder'}
                      </button>
              </div>
                    </div>
                  </div>
                </div>
              )}
    </div>
  )
}
