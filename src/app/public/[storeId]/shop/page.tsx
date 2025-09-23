'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'

interface Product {
  _id: string
  name: string
  price: number
  quantity: number
  totalQuantity: number
  availableQuantity: number
  reservedQuantity: number
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

export default function PublicShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [editingOrder, setEditingOrder] = useState<string | null>(null)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const storeId = params.storeId as string

  // Check for order editing mode
  useEffect(() => {
    const editOrderId = searchParams.get('editOrder')
    if (editOrderId) {
      setEditingOrder(editOrderId)
      loadOrderForEditing(editOrderId)
    }
  }, [searchParams])

  // Check authentication and fetch initial data
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/customer/me', {
          credentials: 'include'
        })
        
        if (!response.ok) {
          router.push(`/public/${storeId}/login`)
          return
        }
        
        const data = await response.json()
        setUser(data.user)
        setStore(data.store)
        
        // Verify store matches URL
        if (data.store.id !== storeId) {
          router.push(`/public/${storeId}/login`)
          return
        }
        
      } catch (err) {
        router.push(`/public/${storeId}/login`)
      }
    }
    
    checkAuth()
  }, [storeId, router])

  // Cleanup reserved stock when component unmounts
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use navigator.sendBeacon for more reliable cleanup
      if (cart.length > 0) {
        for (const item of cart) {
          try {
            const data = JSON.stringify({
              productId: item.product._id,
              quantity: item.quantity,
              action: 'release'
            })
            // Use sendBeacon which is more reliable during page unload
            navigator.sendBeacon('/api/products/reserve', data)
          } catch (err) {
            console.error('Failed to release reserved stock:', err)
          }
        }
      }
    }
    
    // Add cleanup on beforeunload (page refresh/close)
    window.addEventListener('beforeunload', handleBeforeUnload)
    
    // Cleanup when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // Release stock synchronously when component unmounts
      cart.forEach(async (item) => {
        try {
          await fetch('/api/products/reserve', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              productId: item.product._id,
              quantity: item.quantity,
              action: 'release'
            }),
            credentials: 'include'
          })
        } catch (err) {
          console.error('Failed to release reserved stock on unmount:', err)
        }
      })
    }
  }, [])

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      if (!user) return
      
      try {
        const response = await fetch('/api/products/public', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          setProducts(data.products)
        } else {
          setError('Failed to load products')
        }
      } catch (err) {
        setError('Failed to load products')
      } finally {
        setLoading(false)
      }
    }
    
    fetchProducts()
  }, [user])

  const addToCart = async (product: Product) => {
    // Prevent multiple rapid additions
    if (addingToCart === product._id) return
    
    setAddingToCart(product._id)
    setError('')
    setSuccessMessage('')
    
    try {
      const existingItem = cart.find(item => item.product._id === product._id)
      const currentCartQuantity = existingItem ? existingItem.quantity : 0
      const availableStock = product.availableQuantity || product.quantity || 0
      
      // Check if we can add one more item
      if (currentCartQuantity >= availableStock) {
        setError(`Cannot add more ${product.name}. Available stock: ${availableStock}`)
        return
      }
      
      // Reserve stock by calling API to temporarily reduce available quantity
      const response = await fetch('/api/products/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: product._id,
          quantity: 1,
          action: 'reserve'
        }),
        credentials: 'include'
      })
      
      if (!response.ok) {
        const data = await response.json()
        setError(data.message || 'Failed to add item to cart')
        return
      }
      
      // Update local cart state
      setCart(prevCart => {
        if (existingItem) {
          return prevCart.map(item =>
            item.product._id === product._id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        } else {
          return [...prevCart, { product, quantity: 1 }]
        }
      })
      
      // Update product in local state to reflect reduced available quantity
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p._id === product._id 
            ? { ...p, availableQuantity: (p.availableQuantity || p.quantity) - 1 }
            : p
        )
      )
      
      // Show success message
      setSuccessMessage(`${product.name} added to cart!`)
      setTimeout(() => setSuccessMessage(''), 3000)
      
    } catch (err) {
      setError('Failed to add item to cart. Please try again.')
    } finally {
      setAddingToCart(null)
    }
  }

  const updateCartQuantity = async (productId: string, quantity: number) => {
    const cartItem = cart.find(item => item.product._id === productId)
    if (!cartItem) return
    
    const quantityDiff = quantity - cartItem.quantity
    
    if (quantity <= 0) {
      // Remove from cart and release reserved stock
      try {
        await fetch('/api/products/reserve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: productId,
            quantity: cartItem.quantity,
            action: 'release'
          }),
          credentials: 'include'
        })
        
        // Update local state
        setCart(prevCart => prevCart.filter(item => item.product._id !== productId))
        setProducts(prevProducts => 
          prevProducts.map(p => 
            p._id === productId 
              ? { ...p, availableQuantity: (p.availableQuantity || p.quantity) + cartItem.quantity }
              : p
          )
        )
      } catch (err) {
        setError('Failed to update cart. Please try again.')
      }
    } else {
      // Update quantity (reserve more or release some)
      try {
        const response = await fetch('/api/products/reserve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: productId,
            quantity: Math.abs(quantityDiff),
            action: quantityDiff > 0 ? 'reserve' : 'release'
          }),
          credentials: 'include'
        })
        
        if (!response.ok) {
          const data = await response.json()
          setError(data.message || 'Failed to update cart')
          return
        }
        
        // Update local state
        setCart(prevCart =>
          prevCart.map(item =>
            item.product._id === productId
              ? { ...item, quantity: quantity }
              : item
          )
        )
        
        setProducts(prevProducts => 
          prevProducts.map(p => 
            p._id === productId 
              ? { ...p, availableQuantity: (p.availableQuantity || p.quantity) - quantityDiff }
              : p
          )
        )
      } catch (err) {
        setError('Failed to update cart. Please try again.')
      }
    }
  }

  const removeFromCart = async (productId: string) => {
    const cartItem = cart.find(item => item.product._id === productId)
    if (!cartItem) return
    
    try {
      // Release reserved stock
      await fetch('/api/products/reserve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: productId,
          quantity: cartItem.quantity,
          action: 'release'
        }),
        credentials: 'include'
      })
      
      // Update local state
      setCart(prevCart => prevCart.filter(item => item.product._id !== productId))
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p._id === productId 
            ? { ...p, availableQuantity: (p.availableQuantity || p.quantity) + cartItem.quantity }
            : p
        )
      )
    } catch (err) {
      setError('Failed to remove item from cart. Please try again.')
    }
  }

  const getTotalAmount = () => {
    return cart.reduce((total, item) => total + (item.product.price * item.quantity), 0)
  }

  const loadOrderForEditing = async (orderId: string) => {
    try {
      const response = await fetch('/api/orders/public', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const orderToEdit = data.orders.find((order: any) => order._id === orderId)
        
        if (orderToEdit && orderToEdit.status === 'pending' && orderToEdit.approvalStatus === 'pending') {
          // Load order items into cart
          const cartItems = orderToEdit.items.map((item: any) => {
            const product = products.find(p => p.name === item.productName)
            if (product) {
              return {
                product,
                quantity: item.quantity
              }
            }
            return null
          }).filter(Boolean)
          
          setCart(cartItems)
          setError(`Editing order #${orderId.slice(-6)}`)
        } else {
          setError('Order cannot be edited (already processed or not found)')
          // Remove the editOrder parameter
          router.replace(`/public/${storeId}/shop`)
        }
      }
    } catch (err) {
      setError('Failed to load order for editing')
    }
  }

  const confirmPlaceOrder = async () => {
    if (cart.length === 0) return
    
    setSubmitting(true)
    setError('')
    setShowConfirmModal(false)
    
    try {
      const orderItems = cart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity
      }))
      
      const url = editingOrder ? `/api/orders/public/${editingOrder}` : '/api/orders/public'
      const method = editingOrder ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: orderItems,
          notes: ''
        }),
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (response.ok) {
        // Clear cart and navigate - reservations are converted to order in the API
        setCart([])
        setEditingOrder(null)
        setSuccessMessage(editingOrder ? 'Order updated successfully!' : 'Order placed successfully! Waiting for admin approval.')
        setTimeout(() => {
          router.push(`/public/${storeId}/orders`)
        }, 1500)
      } else {
        setError(data.message || 'Failed to place order')
      }
    } catch (err) {
      setError('Failed to place order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      setError('Your cart is empty')
      return
    }
    setShowConfirmModal(true)
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/customer/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } finally {
      router.push(`/public/${storeId}/login`)
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
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-slate-400">Loading products...</p>
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
            <div className="flex items-center space-x-2 sm:space-x-4 min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100 truncate">
                {store?.name}
              </h1>
              <span className="hidden sm:inline text-sm text-gray-500 dark:text-slate-400 truncate">
                Welcome, {user?.name}
              </span>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={() => router.push(`/public/${storeId}/orders`)}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm sm:text-base whitespace-nowrap px-2 py-1 touch-manipulation"
              >
                My Orders
              </button>
              <button
                onClick={logout}
                className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-300 text-sm sm:text-base px-2 py-1 touch-manipulation"
              >
                Logout
              </button>
            </div>
          </div>
          {/* Mobile user info */}
          <div className="sm:hidden pb-2">
            <span className="text-sm text-gray-500 dark:text-slate-400">
              Welcome, {user?.name}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-8">
          {/* Products */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            {/* Search */}
            <div className="mb-4 sm:mb-6">
              <input
                type="text"
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input w-full"
              />
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
              {filteredProducts.map((product) => (
                <div
                  key={product._id}
                  className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4"
                >
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                  )}
                  
                  <h3 className="font-semibold text-gray-900 dark:text-slate-100 mb-1">
                    {product.name}
                  </h3>
                  
                  {product.description && (
                    <p className="text-sm text-gray-600 dark:text-slate-400 mb-2">
                      {product.description}
                    </p>
                  )}
                  
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      ₱{product.price.toFixed(2)}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                      Available: {product.availableQuantity || product.quantity}
                    </span>
                  </div>
                  
                  <button
                    onClick={() => addToCart(product)}
                    disabled={(product.availableQuantity || product.quantity) === 0 || addingToCart === product._id}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors relative touch-manipulation"
                  >
                    {addingToCart === product._id ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Adding...
                      </div>
                    ) : (product.availableQuantity || product.quantity) === 0 ? (
                      'Out of Stock'
                    ) : (
                      'Add to Cart'
                    )}
                  </button>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-slate-400">No products found</p>
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="lg:col-span-1 order-1 lg:order-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6 lg:sticky lg:top-8">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                Shopping Cart ({cart.length})
              </h2>

              {cart.length === 0 ? (
                <p className="text-gray-500 dark:text-slate-400 text-center py-4">
                  Your cart is empty
                </p>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-64 sm:max-h-96 overflow-y-auto">
                    {cart.map((item) => (
                      <div
                        key={item.product._id}
                        className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg space-y-2 sm:space-y-0"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-slate-400">
                            ₱{item.product.price.toFixed(2)} × {item.quantity}
                          </p>
                        </div>
                        
                        <div className="flex items-center justify-between sm:justify-end space-x-2">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)}
                              className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm touch-manipulation"
                            >
                              -
                            </button>
                            <span className="w-8 text-center font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)}
                              className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-600 flex items-center justify-center text-sm touch-manipulation"
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.product._id)}
                            className="ml-2 text-red-500 hover:text-red-700 p-1 touch-manipulation"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 dark:border-slate-600 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                        Total: ₱{getTotalAmount().toFixed(2)}
                      </span>
                    </div>

                    {error && (
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
                      </div>
                    )}
                    
                    {successMessage && (
                      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3 mb-4">
                        <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
                      </div>
                    )}

                    <button
                      onClick={handlePlaceOrder}
                      disabled={submitting || cart.length === 0}
                      className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? 'Placing Order...' : 'Place Order'}
                    </button>

                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 text-center">
                      Orders require admin approval
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="backdrop-blur-md bg-white/95 dark:bg-slate-900/95 rounded-xl shadow-2xl max-w-md w-full border border-slate-200/50 dark:border-slate-700/50 max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Confirm Order</h3>
                <button
                  onClick={() => setShowConfirmModal(false)}
                  className="text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300"
                >
                  <span className="sr-only">Close</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700 dark:text-slate-300">
                  {editingOrder 
                    ? 'Are you sure you want to update this order?' 
                    : 'Are you sure you want to place this order?'
                  }
                </p>
                
                <div className="bg-gray-50 dark:bg-slate-800 rounded-lg p-4">
                  <h4 className="font-medium text-gray-900 dark:text-slate-100 mb-2">Order Summary</h4>
                  <div className="space-y-2">
                    {cart.map((item) => (
                      <div key={item.product._id} className="flex justify-between text-sm">
                        <span className="text-gray-600 dark:text-slate-400">
                          {item.product.name} x {item.quantity}
                        </span>
                        <span className="text-gray-900 dark:text-slate-100">
                          ₱{(item.product.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 dark:border-slate-600 pt-2 mt-2">
                      <div className="flex justify-between font-semibold">
                        <span className="text-gray-900 dark:text-slate-100">Total:</span>
                        <span className="text-gray-900 dark:text-slate-100">₱{getTotalAmount().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-500 dark:text-slate-400">
                  {editingOrder 
                    ? 'Your order changes will be saved and remain pending admin approval.'
                    : 'Your order will be sent for admin approval. You will be notified once it\'s processed.'
                  }
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors touch-manipulation"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmPlaceOrder}
                    disabled={submitting}
                    className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors touch-manipulation"
                  >
                    {submitting 
                      ? (editingOrder ? 'Updating...' : 'Placing...') 
                      : (editingOrder ? 'Update Order' : 'Confirm Order')
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
