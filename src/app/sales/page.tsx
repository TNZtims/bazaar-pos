'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useToast } from '@/contexts/ToastContext'

interface Product {
  _id: string
  name: string
  cost?: number
  price: number
  quantity: number
  category?: string
  imageUrl?: string
}

interface CartItem {
  product: Product
  quantity: number
}

export default function SalesPage() {
  const { success, error, info } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [cartCollapsed, setCartCollapsed] = useState(false)
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

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product._id === product._id)
    
    if (existingItem) {
      if (existingItem.quantity < product.quantity) {
        setCart(cart.map(item =>
          item.product._id === product._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ))
        success(`Added ${product.name} to cart (${existingItem.quantity + 1})`)
      } else {
        error(`Not enough stock available for ${product.name}`)
      }
    } else {
      if (product.quantity > 0) {
        setCart([...cart, { product, quantity: 1 }])
        success(`${product.name} added to cart!`)
      } else {
        error(`${product.name} is out of stock`)
      }
    }
  }

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    const item = cart.find(item => item.product._id === productId)
    
    if (newQuantity <= 0) {
      setCart(cart.filter(item => item.product._id !== productId))
      if (item) {
        info(`${item.product.name} removed from cart`)
      }
    } else {
      setCart(cart.map(item =>
        item.product._id === productId
          ? { ...item, quantity: newQuantity }
          : item
      ))
      if (item) {
        success(`${item.product.name} quantity updated to ${newQuantity}`)
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
        notes: saleData.notes
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
        <div className="space-y-6">
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
                  className={`w-5 h-5 text-gray-500 dark:text-slate-400 transition-transform ${cartCollapsed ? 'rotate-180' : ''}`} 
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

                      {saleData.paymentStatus !== 'paid' && (
                        <div>
                          <input
                            type="text"
                            placeholder="Customer name (required for credit)"
                            value={saleData.customerName}
                            onChange={(e) => setSaleData({ ...saleData, customerName: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                          />
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
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
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

                  {/* Product Info */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-slate-100 text-lg">{product.name}</h3>
                      <p className="text-sm text-gray-600 dark:text-slate-400">{product.category}</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-slate-100 text-lg">₱{product.price.toFixed(2)}</span>
                        <p className="text-sm text-gray-600 dark:text-slate-400">Stock: {product.quantity}</p>
                      </div>
                      <button
                        onClick={() => addToCart(product)}
                        disabled={product.quantity === 0}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                      >
                        {product.quantity === 0 ? 'Out of Stock' : 'Add to Cart'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>


        {/* Confirmation Modal */}
        {confirmModal.isOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[200]">
            <div className="bg-white dark:bg-slate-800 rounded-lg max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center mb-4">
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                  confirmModal.type === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
                }`}>
                  {confirmModal.type === 'danger' ? (
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  )}
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
                    {confirmModal.title}
                  </h3>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-sm text-gray-600 dark:text-slate-400 whitespace-pre-line">
                  {confirmModal.message}
                </p>
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={closeConfirmation}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                >
                  {confirmModal.cancelText}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`px-4 py-2 text-white rounded-md transition-colors ${
                    confirmModal.type === 'danger' 
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  }`}
                >
                  {confirmModal.confirmText}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Image Modal */}
        {imageModal.isOpen && (
          <div 
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[300]"
            onClick={closeImageModal}
          >
            <div 
              className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
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
          </div>
        )}
      </div>
    </Layout>
    </ProtectedRoute>
  )
}