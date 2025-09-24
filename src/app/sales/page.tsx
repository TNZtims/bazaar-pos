'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useToast } from '@/contexts/ToastContext'
import { useAuth } from '@/contexts/AuthContext'
import Modal, { ConfirmationModal } from '@/components/Modal'
import { useWebSocketInventory } from '@/hooks/useWebSocketInventory'

interface Product {
  _id: string
  name: string
  cost?: number
  price: number
  quantity: number
  totalQuantity: number
  availableQuantity: number
  reservedQuantity: number
  availableForPreorder: boolean
  category?: string
  imageUrl?: string
}

interface CartItem {
  product: Product
  quantity: number
}

export default function SalesPage() {
  const { success, error, info } = useToast()
  const { store } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selectedCashier, setSelectedCashier] = useState('')
  const [cartCollapsed, setCartCollapsed] = useState(true)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [selectedQuantities, setSelectedQuantities] = useState<{[productId: string]: number}>({})
  
  // Real-time inventory updates via WebSocket
  const { 
    updates: inventoryUpdates, 
    deletedProducts,
    isConnected: isWebSocketConnected,
    error: webSocketError,
    broadcastCartUpdate
  } = useWebSocketInventory({
    storeId: store?.id || null,
    enabled: !!store?.id
  })
  const [imageModal, setImageModal] = useState<{
    isOpen: boolean
    imageUrl: string
    productName: string
  }>({
    isOpen: false,
    imageUrl: '',
    productName: ''
  })
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

  const [saleData, setSaleData] = useState({
    tax: 0,
    discount: 0,
    paymentMethod: 'cash' as 'cash' | 'card' | 'digital',
    paymentStatus: 'paid' as 'paid' | 'partial' | 'pending',
    amountPaid: 0,
    dueDate: '',
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: ''
  })

  useEffect(() => {
    fetchProducts()
  }, [searchTerm])

  // Page refresh/exit protection with cart cleanup
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (cart.length > 0) {
        const message = 'You have items in your cart. Are you sure you want to leave? All cart data will be lost and reserved stock will be released.'
        
        // Save to localStorage for cleanup fallback
        localStorage.setItem('pendingAdminCartCleanup', JSON.stringify(cart.map(item => ({
          productId: item.product._id,
          quantity: item.quantity
        }))))
        
        // Set returnValue to trigger browser confirmation
        event.returnValue = message
        
        // Release reserved stock using sendBeacon for reliability
        for (const item of cart) {
          try {
            const data = JSON.stringify({
              productId: item.product._id,
              quantity: item.quantity,
              action: 'release'
            })
            const blob = new Blob([data], { type: 'application/json' })
            navigator.sendBeacon('/api/products/admin-reserve', blob)
          } catch (err) {
            console.error('Failed to release reserved stock:', err)
          }
        }
        
        return message
      }
    }
    
    // Check for pending admin cart cleanup on page load
    const pendingCleanup = localStorage.getItem('pendingAdminCartCleanup')
    if (pendingCleanup) {
      console.log('🔄 Found pending admin cart cleanup - releasing reserved stock...')
      try {
        const cartItems = JSON.parse(pendingCleanup)
        
        cartItems.forEach(async (item: any) => {
          try {
            const response = await fetch('/api/products/admin-reserve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: item.productId,
                quantity: item.quantity,
                action: 'release'
              }),
              credentials: 'include'
            })
            
            if (response.ok) {
              console.log(`✅ Released ${item.quantity} units for product ${item.productId}`)
            }
          } catch (err) {
            console.error('Failed to release reserved stock from localStorage:', err)
          }
        })
        
        localStorage.removeItem('pendingAdminCartCleanup')
        console.log('✅ Admin cart cleanup completed')
      } catch (err) {
        console.error('Failed to parse pending admin cart cleanup:', err)
        localStorage.removeItem('pendingAdminCartCleanup')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      
      // Cleanup on component unmount - release reserved stock
      if (cart.length > 0) {
        cart.forEach(async (item) => {
          try {
            await fetch('/api/products/admin-reserve', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productId: item.product._id,
                quantity: item.quantity,
                action: 'release'
              })
            })
          } catch (err) {
            console.error('Failed to release reserved stock on unmount:', err)
          }
        })
      }
    }
  }, [cart])


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

  // Load products on component mount
  useEffect(() => {
    fetchProducts()
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

  // Handle product deletions - remove from products and cart
  useEffect(() => {
    if (deletedProducts.length > 0) {
      setProducts(prevProducts => 
        prevProducts.filter(product => !deletedProducts.includes(product._id))
      )
      
      // Remove deleted products from cart
      setCart(prevCart => 
        prevCart.filter(item => !deletedProducts.includes(item.product._id))
      )
    }
  }, [deletedProducts])

  const openImageModal = (imageUrl: string, productName: string) => {
    setImageModal({
      isOpen: true,
      imageUrl,
      productName
    })
  }

  const closeImageModal = () => {
    setImageModal({
      isOpen: false,
      imageUrl: '',
      productName: ''
    })
  }

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      params.append('limit', '50')
      
      const response = await fetch(`/api/products?${params}`)
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const addToCart = async (product: Product, quantity: number = 1) => {
    // Prevent multiple rapid additions
    if (addingToCart === product._id) return
    
    setAddingToCart(product._id)
    
    try {
      const existingItem = cart.find(item => item.product._id === product._id)
      const currentCartQuantity = existingItem ? existingItem.quantity : 0
      const availableStock = product.availableQuantity || product.quantity || 0
      
      // Check if we can add the requested quantity
      if (currentCartQuantity + quantity > availableStock) {
        error(`Cannot add ${quantity} items of ${product.name}. Available stock: ${availableStock - currentCartQuantity}`)
        return
      }
      
      // For admin sales, we'll immediately reserve the stock
      try {
        const response = await fetch('/api/products/admin-reserve', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            productId: product._id,
            quantity: quantity,
            action: 'reserve'
          })
        })
        
        if (!response.ok) {
          const data = await response.json()
          error(data.message || 'Failed to add item to cart')
          return
        }
      } catch (err) {
        // Fallback to local-only cart for admin sales
        console.warn('Stock reservation failed, proceeding with local cart only')
      }
      
      // Update local cart state
      if (existingItem) {
        setCart(cart.map(item =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        ))
        success(`Added ${quantity} x ${product.name} to cart (Total: ${existingItem.quantity + quantity})`)
      } else {
        setCart([...cart, { product, quantity: quantity }])
        success(`${quantity} x ${product.name} added to cart!`)
      }
      
      // Update product in local state to reflect reduced available quantity
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p._id === product._id 
            ? { ...p, availableQuantity: (p.availableQuantity || p.quantity) - quantity }
            : p
        )
      )
      
      // Reset selected quantity for this product
      setSelectedQuantities(prev => ({
        ...prev,
        [product._id]: 1
      }))
      
      // Broadcast cart update to other clients via WebSocket
      broadcastCartUpdate(product._id, 'reserve', quantity)
      
    } catch (err) {
      error('Failed to add item to cart. Please try again.')
    } finally {
      setAddingToCart(null)
    }
  }

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find(item => item.product._id === productId)
    
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.product._id !== productId))
      if (item) {
        info(`${item.product.name} removed from cart`)
      }
    } else if (item) {
      const availableStock = item.product.availableQuantity || item.product.quantity || 0
      if (newQuantity <= availableStock) {
        setCart(cart.map(cartItem =>
          cartItem.product._id === productId
            ? { ...cartItem, quantity: newQuantity }
            : cartItem
        ))
        success(`${item.product.name} quantity updated to ${newQuantity}`)
      } else {
        error(`Not enough stock available for ${item.product.name}. Available: ${availableStock}`)
      }
    }
  }

  const removeFromCart = (productId: string) => {
    const item = cart.find(item => item.product._id === productId)
    if (item) {
      showConfirmation(
        'Remove Item',
        `Are you sure you want to remove "${item.product.name}" from your cart?`,
        () => {
          setCart(cart.filter(item => item.product._id !== productId))
          info(`${item.product.name} removed from cart`)
          closeConfirmation()
        },
        'warning',
        'Remove',
        'Keep'
      )
    }
  }

  const clearCart = () => {
    if (cart.length === 0) {
      info('Cart is already empty')
      return
    }

    showConfirmation(
      'Clear Cart',
      `Are you sure you want to remove all ${cart.length} item(s) from your cart? This action cannot be undone.`,
      () => {
        setCart([])
        // Clear any pending cleanup when manually clearing cart
        localStorage.removeItem('pendingAdminCartCleanup')
        info('Cart cleared')
        closeConfirmation()
      },
      'danger',
      'Clear All',
      'Keep Items'
    )
  }

  const getProductImage = (product: Product) => {
    if (product.imageUrl) return product.imageUrl
    return '/images/products/default.svg'
  }

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    const total = subtotal + saleData.tax - saleData.discount
    return { subtotal, total }
  }

  const { total } = calculateTotals()

  const handleCheckout = async () => {
    if (cart.length === 0) {
      error('Cart is empty')
      return
    }

    if (saleData.paymentStatus !== 'paid' && !saleData.customerName.trim()) {
      error('Customer name is required for credit sales')
      return
    }

    if (!selectedCashier.trim()) {
      error('Please select a cashier for this sale')
      return
    }

    if (saleData.paymentStatus === 'partial') {
      if (saleData.amountPaid <= 0) {
        error('Amount paid must be greater than 0 for partial payments')
        return
      }
      if (saleData.amountPaid >= total) {
        error('Amount paid cannot be greater than or equal to total. Use "Pay Full" instead.')
        return
      }
    }

    // Show confirmation before proceeding
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0)
    const paymentText = saleData.paymentStatus === 'paid' ? 'Process full payment' :
                       saleData.paymentStatus === 'partial' ? `Process partial payment (₱${saleData.amountPaid.toFixed(2)})` :
                       'Create order (Pay Later)'
    
    showConfirmation(
      'Confirm Sale',
      `${totalItems} item(s) • Total: ₱${total.toFixed(2)}\n${paymentText}${saleData.customerName ? `\nCustomer: ${saleData.customerName}` : ''}`,
      () => {
        closeConfirmation()
        processCheckout()
      },
      'warning',
      'Process Sale',
      'Review Cart'
    )
  }

  const processCheckout = async () => {
    setProcessing(true)

    try {
      const saleItems = cart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity
      }))

      const requestData = {
        items: saleItems,
        tax: saleData.tax,
        discount: saleData.discount,
        paymentMethod: saleData.paymentMethod,
        paymentStatus: saleData.paymentStatus,
        amountPaid: saleData.amountPaid,
        dueDate: saleData.dueDate || undefined,
        customerName: saleData.customerName,
        customerPhone: saleData.customerPhone,
        customerEmail: saleData.customerEmail,
        notes: saleData.notes,
        cashier: selectedCashier
      }

      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData)
      })

      if (response.ok) {
        let message = 'Sale completed successfully!'
        if (saleData.paymentStatus === 'partial') {
          message = `Sale created! Paid: ₱${saleData.amountPaid.toFixed(2)}, Due: ₱${(total - saleData.amountPaid).toFixed(2)}`
        } else if (saleData.paymentStatus === 'pending') {
          message = `Order created! Total due: ₱${total.toFixed(2)}`
        }
        
        success(message)
        setCart([])
        
        // Clear any pending cleanup since sale was successfully processed
        localStorage.removeItem('pendingAdminCartCleanup')
        setSaleData({
          tax: 0,
          discount: 0,
          paymentMethod: 'cash',
          paymentStatus: 'paid',
          amountPaid: 0,
          dueDate: '',
          customerName: '',
          customerPhone: '',
          customerEmail: '',
          notes: ''
        })
        fetchProducts()
      } else {
        const errorData = await response.json()
        error(`Error: ${errorData.message}`)
      }
    } catch (err) {
      console.error('Error processing sale:', err)
      error('Error processing sale. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 px-4 sm:px-0">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Sales & Checkout</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Add products to cart and process sales</p>
        </div>

        {/* Sticky Cart at Top */}
        <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 pb-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            {/* Cart Header */}
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700"
              onClick={() => setCartCollapsed(!cartCollapsed)}
            >
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">Shopping Cart</h2>
                <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  {cart.length}
                </div>
                {cart.length > 0 && (
                  <span className="font-medium text-gray-900 dark:text-slate-100">
                    ₱{cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toFixed(2)}
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-2">
                     {cart.length > 0 && !cartCollapsed && (
                       <>
                         <button
                           onClick={(e) => {
                             e.stopPropagation()
                             clearCart()
                           }}
                           className="bg-red-600 text-white px-3 py-2 rounded-md hover:bg-red-700 transition-colors text-sm"
                         >
                           Clear
                         </button>
                         <button
                           onClick={(e) => {
                             e.stopPropagation()
                             handleCheckout()
                           }}
                           disabled={processing}
                           className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-sm"
                         >
                           {processing ? 'Processing...' : 'Checkout'}
                         </button>
                       </>
                     )}
                <svg 
                  className={`w-5 h-5 text-gray-500 dark:text-slate-400 transition-transform ${!cartCollapsed ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Cart Content */}
            {!cartCollapsed && (
              <div className="border-t border-gray-200 dark:border-slate-600 p-4">
                {/* Customer Name Field */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter customer name (optional)"
                    value={saleData.customerName}
                    onChange={(e) => setSaleData({ ...saleData, customerName: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {cart.length === 0 ? (
                  <p className="text-gray-500 dark:text-slate-400 text-center py-4">Cart is empty</p>
                ) : (
                  <div className="space-y-4">
                    {/* Cart Items */}
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.product._id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-slate-600">
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-slate-100">{item.product.name}</h4>
                            <p className="text-sm text-gray-600 dark:text-slate-400">₱{item.product.price.toFixed(2)} each</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-gray-900 dark:text-slate-100">{item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeFromCart(item.product._id)}
                              className="ml-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Quick Checkout Form */}
                    <div className="border-t border-gray-200 dark:border-slate-600 pt-4 space-y-3">
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Tax (₱)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={saleData.tax}
                            onChange={(e) => setSaleData({ ...saleData, tax: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Discount (₱)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={saleData.discount}
                            onChange={(e) => setSaleData({ ...saleData, discount: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Payment</label>
                          <select
                            value={saleData.paymentStatus}
                            onChange={(e) => setSaleData({ ...saleData, paymentStatus: e.target.value as any })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                          >
                            <option value="paid">Pay Full</option>
                            <option value="partial">Partial</option>
                            <option value="pending">Pay Later</option>
                          </select>
                        </div>
                      </div>

                      {/* Amount Paid (for partial payments) */}
                      {saleData.paymentStatus === 'partial' && (
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                            Amount Paid *
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={total}
                            step="0.01"
                            value={saleData.amountPaid}
                            onChange={(e) => setSaleData({ ...saleData, amountPaid: parseFloat(e.target.value) || 0 })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                            placeholder="Enter amount received"
                            required
                          />
                          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                            Remaining: ₱{Math.max(0, total - saleData.amountPaid).toFixed(2)}
                          </p>
                        </div>
                      )}

                      {/* Due Date (for partial and pending payments) */}
                      {(saleData.paymentStatus === 'partial' || saleData.paymentStatus === 'pending') && (
                        <div>
                          <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                            Due Date
                          </label>
                          <input
                            type="date"
                            value={saleData.dueDate}
                            onChange={(e) => setSaleData({ ...saleData, dueDate: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                          />
                        </div>
                      )}

                      {/* Cashier Selection */}
                      <div>
                        <label className="block text-xs text-gray-600 dark:text-slate-400 mb-1">
                          Cashier *
                        </label>
                        <select
                          value={selectedCashier}
                          onChange={(e) => setSelectedCashier(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                          required
                        >
                          <option value="">Select Cashier</option>
                          {store?.cashiers?.map((cashier) => (
                            <option key={cashier} value={cashier}>
                              {cashier}
                            </option>
                          ))}
                        </select>
                      </div>

                      {saleData.paymentStatus !== 'paid' && !saleData.customerName.trim() && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded p-3">
                          <p className="text-xs text-yellow-800 dark:text-yellow-300">
                            ⚠️ Customer name is required for credit sales. Please enter it in the cart section above.
                          </p>
                        </div>
                      )}

                      {/* Total */}
                      <div className="flex justify-between items-center text-lg font-semibold text-gray-900 dark:text-slate-100 pt-2 border-t border-gray-200 dark:border-slate-600">
                        <span>Total:</span>
                        <span>₱{total.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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

        {/* Products Grid */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          {loading ? (
            <div className="p-8 text-center text-gray-600 dark:text-slate-400">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              No products found. {searchTerm ? 'Try a different search term.' : 'Add products first!'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 hover:shadow-md transition-shadow bg-white dark:bg-slate-700"
                >
                  {/* Product Image - Larger and Clickable */}
                  <div className="mb-4">
                    <img
                      src={getProductImage(product)}
                      alt={product.name}
                      className="w-full h-32 sm:h-40 rounded-lg object-cover border border-gray-200 dark:border-slate-600 cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => openImageModal(getProductImage(product), product.name)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/products/default.svg'
                      }}
                    />
                  </div>

                  {/* Product Info - Consistent Structure */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-slate-100 text-lg">{product.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-slate-400 min-h-[1.25rem]">
                        {product.description || product.category || ''}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold text-blue-600 dark:text-blue-400">₱{product.price.toFixed(2)}</span>
                      <span className="text-sm text-gray-600 dark:text-slate-400">Available: {product.quantity}</span>
                    </div>
                      
                    {/* Quantity Selector and Add to Cart */}
                    <div className="space-y-2">
                      {product.quantity > 0 && (
                        <div className="flex items-center space-x-2 mb-2">
                          <label className="text-sm font-medium text-gray-700 dark:text-slate-300">
                            Qty:
                          </label>
                          <div className="flex items-center border border-gray-300 dark:border-slate-600 rounded-md">
                            <button
                              onClick={() => {
                                const currentQty = selectedQuantities[product._id] || 1
                                if (currentQty > 1) {
                                  setSelectedQuantities(prev => ({
                                    ...prev,
                                    [product._id]: currentQty - 1
                                  }))
                                }
                              }}
                              className="px-2 py-1 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={product.availableQuantity || product.quantity}
                              value={selectedQuantities[product._id] || 1}
                              onChange={(e) => {
                                const value = Math.max(1, Math.min(
                                  parseInt(e.target.value) || 1,
                                  product.availableQuantity || product.quantity
                                ))
                                setSelectedQuantities(prev => ({
                                  ...prev,
                                  [product._id]: value
                                }))
                              }}
                              className="w-16 px-2 py-1 text-center border-0 bg-transparent text-gray-900 dark:text-slate-100 focus:outline-none"
                            />
                            <button
                              onClick={() => {
                                const currentQty = selectedQuantities[product._id] || 1
                                const maxQty = product.quantity
                                if (currentQty < maxQty) {
                                  setSelectedQuantities(prev => ({
                                    ...prev,
                                    [product._id]: currentQty + 1
                                  }))
                                }
                              }}
                              className="px-2 py-1 text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )}
                      
                      <button
                        onClick={() => addToCart(product, selectedQuantities[product._id] || 1)}
                        disabled={product.quantity === 0 || addingToCart === product._id}
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors relative"
                      >
                        {addingToCart === product._id ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Adding...
                          </div>
                        ) : product.quantity === 0 ? (
                          'Out of Stock'
                        ) : (
                          `Add ${selectedQuantities[product._id] || 1} to Cart`
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


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

        {/* Image Modal */}
        <Modal 
          isOpen={imageModal.isOpen} 
          onClose={closeImageModal}
          size="xl"
          className="bg-black/90"
          showCloseButton={false}
        >
          <div className="relative -m-6 flex items-center justify-center min-h-[70vh]">
            {/* Close Button */}
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center transition-colors"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Image */}
            <img
              src={imageModal.imageUrl}
              alt={imageModal.productName}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/products/default.svg'
              }}
            />

            {/* Product Name */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-lg">
              <p className="text-lg font-medium text-center">{imageModal.productName}</p>
            </div>
          </div>
        </Modal>
      </div>
    </Layout>
    </ProtectedRoute>
  )
}