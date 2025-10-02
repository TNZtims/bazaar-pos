'use client'

import { useState, useEffect } from 'react'
import { useToast } from '@/contexts/ToastContext'
import Modal from '@/components/Modal'

interface Product {
  _id: string
  name: string
  price: number
  quantity: number
  category?: string
  cost?: number
}

interface SaleItem {
  productName: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface Order {
  _id: string
  finalAmount: number
  subtotal: number
  tax: number
  discount: number
  paymentStatus: 'paid' | 'partial' | 'pending' | 'overdue'
  paymentMethod: 'cash' | 'card' | 'digital' | 'mixed'
  amountPaid: number
  amountDue: number
  dueDate?: string
  customerName?: string
  customerPhone?: string
  customerEmail?: string
  notes?: string
  status: string
  createdAt: string
  items: SaleItem[]
}

interface CartItem {
  product: Product
  quantity: number
}

interface OrderEditModalProps {
  order: Order | null
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

export default function OrderEditModal({ order, isOpen, onClose, onUpdate }: OrderEditModalProps) {
  const { success, error } = useToast()
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orderDetails, setOrderDetails] = useState({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    notes: '',
    dueDate: '',
    tax: 0,
    discount: 0
  })
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'items' | 'details'>('items')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (order && isOpen) {
      // Initialize order details first
      setOrderDetails({
        customerName: order.customerName || '',
        customerPhone: order.customerPhone || '',
        customerEmail: order.customerEmail || '',
        notes: order.notes || '',
        dueDate: order.dueDate ? order.dueDate.split('T')[0] : '',
        tax: order.tax || 0,
        discount: order.discount || 0
      })

      // Initialize cart with current order items
      initializeCartFromOrder()
    }
  }, [order, isOpen])

  const initializeCartFromOrder = async () => {
    if (!order) return

    try {
      // Fetch all products to get current stock information
      const response = await fetch('/api/products?limit=1000')
      const data = await response.json()
      const allProducts = data.products || []

      // Create cart items from order items, matching with actual product data
      const cartItems: CartItem[] = []
      
      for (const orderItem of order.items) {
        // Find the actual product by name (since we don't have product ID in order items)
        const product = allProducts.find((p: Product) => p.name === orderItem.productName)
        
        if (product) {
          cartItems.push({
            product: {
              _id: product._id,
              name: product.name,
              price: product.price,
              quantity: product.quantity,
              category: product.category,
              cost: product.cost
            },
            quantity: orderItem.quantity
          })
        } else {
          // If product not found, create a placeholder but mark it as unavailable
          console.warn(`Product "${orderItem.productName}" not found in inventory`)
          cartItems.push({
            product: {
              _id: 'missing-' + orderItem.productName,
              name: orderItem.productName,
              price: orderItem.unitPrice,
              quantity: 0, // Mark as unavailable
              category: 'Unknown',
              cost: 0
            },
            quantity: orderItem.quantity
          })
        }
      }
      
      setCart(cartItems)
    } catch (error) {
      console.error('Error initializing cart from order:', error)
      // Fallback to basic cart initialization
      const cartItems: CartItem[] = order.items.map(item => ({
        product: {
          _id: 'temp-' + item.productName,
          name: item.productName,
          price: item.unitPrice,
          quantity: 0,
        },
        quantity: item.quantity
      }))
      setCart(cartItems)
    }
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
    }
  }

  useEffect(() => {
    if (isOpen) {
      fetchProducts()
    }
  }, [searchTerm, isOpen])

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.product._id === product._id)
    const currentCartQuantity = existingItem ? existingItem.quantity : 0
    const availableStock = product.availableQuantity || product.quantity || 0
    
    // Check if we can add one more item
    if (currentCartQuantity >= availableStock) {
      alert(`Cannot add more ${product.name}. Available stock: ${availableStock}`)
      return
    }
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.product._id === product._id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ))
    } else {
      setCart([...cart, { product, quantity: 1 }])
    }
  }

  const updateCartQuantity = (productId: string, newQuantity: number) => {
    console.log(`Updating cart quantity for ${productId}: ${newQuantity}`)
    
    if (newQuantity === 0) {
      setCart(cart.filter(item => item.product._id !== productId))
      console.log(`Removed item ${productId} from cart`)
    } else {
      // Validate stock availability
      const product = products.find(p => p._id === productId)
      const availableStock = product ? (product.availableQuantity || product.quantity || 0) : 0
      
      if (newQuantity > availableStock) {
        alert(`Cannot set quantity to ${newQuantity}. Available stock: ${availableStock}`)
        return
      }
      
      setCart(cart.map(item =>
        item.product._id === productId
          ? { ...item, quantity: newQuantity }
          : item
      ))
      console.log(`Updated quantity for ${productId} to ${newQuantity}`)
    }
  }

  const removeFromCart = (productId: string) => {
    console.log(`Removing item ${productId} from cart`)
    setCart(cart.filter(item => item.product._id !== productId))
    console.log(`Cart after removal:`, cart.filter(item => item.product._id !== productId))
  }

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    const total = subtotal + orderDetails.tax - orderDetails.discount
    return { subtotal, total }
  }

  const handleUpdateItems = async () => {
    if (!order) return

    setLoading(true)
    try {
      // Filter out items with quantity 0 (removed items) and validate product IDs
      const items = cart
        .filter(item => item.quantity > 0) // Only include items with quantity > 0
        .map(item => ({
          productId: item.product._id,
          quantity: item.quantity
        }))
        .filter(item => !item.productId.startsWith('temp-') && !item.productId.startsWith('missing-')) // Exclude temporary/missing products

      // Check if we have any valid items
      if (items.length === 0) {
        error('Cannot update order with no items. Please add at least one product.', 'Invalid Update')
        setLoading(false)
        return
      }

      console.log('Updating order with items:', items)

      const response = await fetch(`/api/sales/${order._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_items',
          items,
          tax: orderDetails.tax,
          discount: orderDetails.discount,
          customerName: orderDetails.customerName,
          customerPhone: orderDetails.customerPhone,
          customerEmail: orderDetails.customerEmail,
          notes: orderDetails.notes,
          dueDate: orderDetails.dueDate || undefined
        })
      })

      if (response.ok) {
        const updatedOrder = await response.json()
        console.log('Order updated successfully:', updatedOrder)
        success('Order updated successfully!', 'Order Updated')
        onUpdate()
        onClose()
      } else {
        const errorData = await response.json()
        console.error('Error updating order:', errorData)
        error(errorData.message || 'Error updating order', 'Update Failed')
      }
    } catch (err) {
      console.error('Error updating order:', err)
      error('Error updating order', 'Update Failed')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateDetails = async () => {
    if (!order) return

    setLoading(true)
    try {
      const response = await fetch(`/api/sales/${order._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_order_details',
          ...orderDetails,
          dueDate: orderDetails.dueDate || undefined
        })
      })

      if (response.ok) {
        success('Order details updated successfully!', 'Details Updated')
        onUpdate()
        onClose()
      } else {
        const errorData = await response.json()
        error(errorData.message || 'Error updating order details', 'Update Failed')
      }
    } catch (err) {
      console.error('Error updating order details:', err)
      error('Error updating order details', 'Update Failed')
    } finally {
      setLoading(false)
    }
  }

  const { subtotal, total } = calculateTotals()

  if (!isOpen || !order) return null

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={`Edit Order #${order._id.slice(-6)}`}
      size="xl"
    >
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-slate-600 -mt-2 mb-6">
        <div className="flex space-x-8">
              <button
                onClick={() => setActiveTab('items')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'items'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                Items & Quantities
              </button>
              <button
                onClick={() => setActiveTab('details')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'details'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300'
                }`}
              >
                Order Details
              </button>
            </div>
          </div>

        <div>
          {activeTab === 'items' ? (
            <div className="flex flex-col lg:grid lg:grid-cols-2 gap-4 lg:gap-6">
              {/* Products */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-slate-100">Add Products</h3>
                
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {products.map((product) => (
                    <div
                      key={product._id}
                      className="border border-gray-200 dark:border-slate-600 rounded-lg p-3 hover:shadow-md transition-shadow bg-white dark:bg-slate-700"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-slate-100">{product.name}</h4>
                          <p className="text-sm text-gray-600 dark:text-slate-400">₱{product.price.toFixed(2)} • Stock: {product.quantity}</p>
                        </div>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={product.quantity === 0}
                          className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cart */}
              <div>
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-slate-100">Order Items</h3>
                
                <div className="space-y-3 mb-6">
                  {cart.map((item) => {
                    const isMissing = item.product._id.startsWith('missing-')
                    const isTemp = item.product._id.startsWith('temp-')
                    const isUnavailable = item.product.quantity === 0 && !isMissing && !isTemp
                    
                    return (
                      <div
                        key={item.product._id}
                        className={`border rounded-lg p-3 ${
                          isMissing || isTemp || isUnavailable 
                            ? 'border-red-300 dark:border-red-600 bg-red-50 dark:bg-red-900/20' 
                            : 'border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <h4 className={`font-medium ${
                              isMissing || isTemp || isUnavailable 
                                ? 'text-red-800 dark:text-red-200' 
                                : 'text-gray-900 dark:text-slate-100'
                            }`}>
                              {item.product.name}
                              {(isMissing || isTemp) && (
                                <span className="ml-2 text-xs bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200 px-2 py-1 rounded">
                                  Product Not Found
                                </span>
                              )}
                              {isUnavailable && (
                                <span className="ml-2 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 px-2 py-1 rounded">
                                  Out of Stock
                                </span>
                              )}
                            </h4>
                            <p className={`text-sm ${
                              isMissing || isTemp || isUnavailable 
                                ? 'text-red-600 dark:text-red-400' 
                                : 'text-gray-600 dark:text-slate-400'
                            }`}>
                              ₱{item.product.price.toFixed(2)} each
                              {!isMissing && !isTemp && (
                                <span className="ml-2">• Stock: {item.product.quantity}</span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)}
                              disabled={isMissing || isTemp}
                              className={`w-8 h-8 rounded ${
                                isMissing || isTemp
                                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-500'
                              }`}
                            >
                              -
                            </button>
                            <span className={`w-12 text-center ${
                              isMissing || isTemp || isUnavailable 
                                ? 'text-red-800 dark:text-red-200' 
                                : 'text-gray-900 dark:text-slate-100'
                            }`}>
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)}
                              disabled={isMissing || isTemp || isUnavailable}
                              className={`w-8 h-8 rounded ${
                                isMissing || isTemp || isUnavailable
                                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-400 cursor-not-allowed'
                                  : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-500'
                              }`}
                            >
                              +
                            </button>
                            <button
                              onClick={() => removeFromCart(item.product._id)}
                              className="bg-red-500 text-white w-8 h-8 rounded hover:bg-red-600 ml-2"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 text-right">
                          <span className={`font-semibold ${
                            isMissing || isTemp || isUnavailable 
                              ? 'text-red-800 dark:text-red-200' 
                              : 'text-gray-900 dark:text-slate-100'
                          }`}>
                            ₱{(item.product.price * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                  
                  {cart.length === 0 && (
                    <div className="text-center py-8 text-gray-500 dark:text-slate-400">
                      <p>No items in this order.</p>
                      <p className="text-sm mt-1">Add products from the left panel.</p>
                    </div>
                  )}
                </div>

                {/* Tax and Discount */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tax (₱)</label>
                    <input
                      type="number"
                      value={orderDetails.tax}
                      onChange={(e) => setOrderDetails({ ...orderDetails, tax: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Discount (₱)</label>
                    <input
                      type="number"
                      value={orderDetails.discount}
                      onChange={(e) => setOrderDetails({ ...orderDetails, discount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t border-gray-200 dark:border-slate-600 pt-4">
                  <div className="flex justify-between text-gray-900 dark:text-slate-100">
                    <span>Subtotal:</span>
                    <span>₱{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-900 dark:text-slate-100">
                    <span>Tax:</span>
                    <span>₱{orderDetails.tax.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-900 dark:text-slate-100">
                    <span>Discount:</span>
                    <span>-₱{orderDetails.discount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg border-t border-gray-200 dark:border-slate-600 pt-2 text-gray-900 dark:text-slate-100">
                    <span>Total:</span>
                    <span>₱{total.toFixed(2)}</span>
                  </div>
                </div>

                <button
                  onClick={handleUpdateItems}
                  disabled={loading || cart.filter(item => item.quantity > 0 && !item.product._id.startsWith('temp-') && !item.product._id.startsWith('missing-')).length === 0}
                  className="w-full mt-4 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : `Update Items (${cart.filter(item => item.quantity > 0 && !item.product._id.startsWith('temp-') && !item.product._id.startsWith('missing-')).length} products)`}
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <h3 className="text-lg font-semibold mb-6 text-gray-900 dark:text-slate-100">Order Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Customer Name</label>
                  <input
                    type="text"
                    value={orderDetails.customerName}
                    onChange={(e) => setOrderDetails({ ...orderDetails, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Phone</label>
                    <input
                      type="text"
                      value={orderDetails.customerPhone}
                      onChange={(e) => setOrderDetails({ ...orderDetails, customerPhone: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={orderDetails.customerEmail}
                      onChange={(e) => setOrderDetails({ ...orderDetails, customerEmail: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={orderDetails.dueDate}
                    onChange={(e) => setOrderDetails({ ...orderDetails, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Tax (₱)</label>
                    <input
                      type="number"
                      value={orderDetails.tax}
                      onChange={(e) => setOrderDetails({ ...orderDetails, tax: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Discount (₱)</label>
                    <input
                      type="number"
                      value={orderDetails.discount}
                      onChange={(e) => setOrderDetails({ ...orderDetails, discount: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Notes</label>
                  <textarea
                    value={orderDetails.notes}
                    onChange={(e) => setOrderDetails({ ...orderDetails, notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100"
                  />
                </div>

                <button
                  onClick={handleUpdateDetails}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating...' : 'Update Details'}
                </button>
              </div>
            </div>
          )}
        </div>
    </Modal>
  )
}
