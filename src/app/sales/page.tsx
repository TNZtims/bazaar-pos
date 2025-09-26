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
  description?: string
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
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [productsPerPage] = useState(20) // 4 rows × 5 columns = 20 products per page
  const [processing, setProcessing] = useState(false)
  const [selectedCashier, setSelectedCashier] = useState('')
  const [cartModalOpen, setCartModalOpen] = useState(false)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [selectedQuantities, setSelectedQuantities] = useState<{[productId: string]: number}>({})
  const [cartLoaded, setCartLoaded] = useState(false)
  const [cartWarningModal, setCartWarningModal] = useState<{
    isOpen: boolean
    onConfirm: () => void
    onCancel: () => void
    message: string
  }>({
    isOpen: false,
    onConfirm: () => {},
    onCancel: () => {},
    message: ''
  })
  const [isNavigationBlocked, setIsNavigationBlocked] = useState(false)
  const [refreshWarningModal, setRefreshWarningModal] = useState<{
    isOpen: boolean
    onConfirm: () => void
    onCancel: () => void
  }>({
    isOpen: false,
    onConfirm: () => {},
    onCancel: () => {}
  })
  
  // Real-time inventory updates via WebSocket
  const { 
    updates: inventoryUpdates, 
    deletedProducts,
    cartUpdates,
    isConnected: isWebSocketConnected,
    error: webSocketError,
    broadcastCartUpdate
  } = useWebSocketInventory({
    storeId: store?.id || null,
    enabled: !!store?.id
  })

  // State to track reserved quantities from other cashiers
  const [otherCashiersReservations, setOtherCashiersReservations] = useState<{[productId: string]: number}>({})

  // Handle cart updates from other cashiers
  useEffect(() => {
    if (cartUpdates.length > 0) {
      console.log('Processing cart updates:', cartUpdates)
      
      const newReservations: {[productId: string]: number} = {}
      
      cartUpdates.forEach(update => {
        if (update.action === 'reserve') {
          newReservations[update.productId] = (newReservations[update.productId] || 0) + update.quantity
        } else if (update.action === 'release') {
          newReservations[update.productId] = Math.max(0, (newReservations[update.productId] || 0) - update.quantity)
        }
      })
      
      setOtherCashiersReservations(prev => {
        const updated = {
          ...prev,
          ...newReservations
        }
        console.log('Updated other cashiers reservations:', updated)
        return updated
      })
      
      // Show notification for significant cart changes
      const latestUpdate = cartUpdates[cartUpdates.length - 1]
      if (latestUpdate && products.length > 0) {
        const product = products.find(p => p._id === latestUpdate.productId)
        if (product) {
          const actionText = latestUpdate.action === 'reserve' ? 'reserved' : 'released'
          info(`🔄 Another cashier ${actionText} ${latestUpdate.quantity} ${product.name}`)
        }
      }
    }
  }, [cartUpdates, products])
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
    setCurrentPage(1) // Reset to first page when search changes
    fetchProducts()
  }, [searchTerm])

  useEffect(() => {
    fetchProducts()
  }, [currentPage]) // Fetch products when page changes

  // Cart API functions
  const loadCartFromAPI = async () => {
    try {
      const response = await fetch('/api/cart', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const cartData = await response.json()
        
        // Convert API response to local cart format
        const cartItems: CartItem[] = cartData.items.map((item: any) => ({
          product: item.product,
          quantity: item.quantity
        }))
        
        // Check if cart was intentionally cleared
        const wasCartCleared = localStorage.getItem('cartCleared') === 'true'
        
        // Only restore cart if it has items and wasn't intentionally cleared
        if (cartItems.length > 0 && !wasCartCleared) {
          setCart(cartItems)
          console.log(`📦 Restored ${cartItems.length} items from database`)
        } else {
          // Cart is empty or was intentionally cleared, don't restore
          setCart([])
          if (wasCartCleared) {
            console.log('📦 Cart was intentionally cleared, not restoring')
          } else {
            console.log('📦 Cart is empty, not restoring')
          }
        }
        
        // Set other form data
        setSaleData(prev => ({
          ...prev,
          customerName: cartData.customerName || '',
          customerPhone: cartData.customerPhone || '',
          customerEmail: cartData.customerEmail || '',
          notes: cartData.notes || '',
          tax: cartData.tax || 0,
          discount: cartData.discount || 0,
          paymentMethod: cartData.paymentMethod || 'cash',
          paymentStatus: cartData.paymentStatus || 'paid',
          amountPaid: cartData.amountPaid || 0,
          dueDate: cartData.dueDate || ''
        }))
        
        setSelectedCashier(cartData.selectedCashier || '')
      }
    } catch (error) {
      console.error('Failed to load cart from API:', error)
    }
  }

  const saveCartToAPI = async (cartData: CartItem[], formData?: any) => {
    try {
      const updateData: any = {
        items: cartData.map(item => ({
          product: item.product._id,
          productName: item.product.name,
          quantity: item.quantity,
          unitPrice: item.product.price
        }))
      }
      
      // Include form data if provided
      if (formData) {
        Object.assign(updateData, formData)
      }
      
      await fetch('/api/cart', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData),
        credentials: 'include'
      })
    } catch (error) {
      console.error('Failed to save cart to API:', error)
    }
  }

  const clearCartFromAPI = async () => {
    try {
      await fetch('/api/cart', {
        method: 'DELETE',
        credentials: 'include'
      })
      // Mark cart as intentionally cleared in localStorage
      localStorage.setItem('cartCleared', 'true')
      console.log('🗑️ Cart cleared from database')
    } catch (error) {
      console.error('Failed to clear cart from API:', error)
    }
  }

  // Clear the cart cleared flag when cart has items (user added items legitimately)
  useEffect(() => {
    if (cart.length > 0) {
      localStorage.removeItem('cartCleared')
    }
  }, [cart])

  // Load cart from API on component mount
  useEffect(() => {
    loadCartFromAPI().finally(() => {
      setCartLoaded(true)
    })
  }, [])

  // Save cart to API whenever cart changes (but only after initial load)
  useEffect(() => {
    if (cartLoaded && cart.length >= 0) {
      // Temporarily disable automatic saving to avoid 500 errors
      // saveCartToAPI(cart, {
      //   customerName: saleData.customerName,
      //   customerPhone: saleData.customerPhone,
      //   customerEmail: saleData.customerEmail,
      //   notes: saleData.notes,
      //   tax: saleData.tax,
      //   discount: saleData.discount,
      //   paymentMethod: saleData.paymentMethod,
      //   paymentStatus: saleData.paymentStatus,
      //   amountPaid: saleData.amountPaid,
      //   dueDate: saleData.dueDate,
      //   selectedCashier: selectedCashier
      // })
    }
  }, [cart, cartLoaded])

  // Save form data changes to API
  useEffect(() => {
    if (cartLoaded) {
      // Temporarily disable automatic saving to avoid 500 errors
      // saveCartToAPI(cart, {
      //   customerName: saleData.customerName,
      //   customerPhone: saleData.customerPhone,
      //   customerEmail: saleData.customerEmail,
      //   notes: saleData.notes,
      //   tax: saleData.tax,
      //   discount: saleData.discount,
      //   paymentMethod: saleData.paymentMethod,
      //   paymentStatus: saleData.paymentStatus,
      //   amountPaid: saleData.amountPaid,
      //   dueDate: saleData.dueDate,
      //   selectedCashier: selectedCashier
      // })
    }
  }, [saleData, selectedCashier, cartLoaded])

  // Cart warning functions
  const showCartWarning = (message: string, onConfirm: () => void, onCancel: () => void) => {
    if (isNavigationBlocked) return // Prevent multiple modals
    
    setIsNavigationBlocked(true)
    setCartWarningModal({
      isOpen: true,
      message,
      onConfirm: () => {
        setIsNavigationBlocked(false)
        onConfirm()
      },
      onCancel: () => {
        setIsNavigationBlocked(false)
        onCancel()
      }
    })
  }

  const closeCartWarning = () => {
    setIsNavigationBlocked(false)
    setCartWarningModal(prev => ({ ...prev, isOpen: false }))
  }

  // Refresh warning functions
  const showRefreshWarning = (onConfirm: () => void, onCancel: () => void) => {
    if (isNavigationBlocked) return
    
    setIsNavigationBlocked(true)
    setRefreshWarningModal({
      isOpen: true,
      onConfirm: () => {
        setIsNavigationBlocked(false)
        onConfirm()
      },
      onCancel: () => {
        setIsNavigationBlocked(false)
        onCancel()
      }
    })
  }

  const closeRefreshWarning = () => {
    setIsNavigationBlocked(false)
    setRefreshWarningModal(prev => ({ ...prev, isOpen: false }))
  }

  // Page refresh/exit protection with custom modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (cart.length === 0 || isNavigationBlocked) return

      // Detect refresh shortcuts: F5, Ctrl+R, Ctrl+Shift+R, Cmd+R
      const isRefresh = 
        event.key === 'F5' ||
        (event.ctrlKey && event.key === 'r') ||
        (event.ctrlKey && event.shiftKey && event.key === 'R') ||
        (event.metaKey && event.key === 'r')

      if (isRefresh) {
        event.preventDefault()
        event.stopPropagation()
        
        showRefreshWarning(
          async () => {
            // User confirmed - clear cart and refresh
            setCart([])
            setSelectedQuantities({})
            // Clear cart from database
            await clearCartFromAPI()
            closeRefreshWarning()
            setTimeout(() => {
              window.location.reload()
            }, 100)
          },
          () => {
            // User cancelled - just close modal
            closeRefreshWarning()
          }
        )
      }
    }

    // Also keep the beforeunload for browser close/tab close
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (cart.length > 0) {
        const message = `You have ${cart.length} item(s) in your cart. If you leave, your cart will be cleared and you'll lose these items.`
        event.returnValue = message
        return message
      }
    }

    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [cart, isNavigationBlocked])

  // Navigation protection within the app
  useEffect(() => {
    // Store the intended navigation target
    let pendingNavigation: string | null = null

    // Intercept link clicks to show cart warning
    const handleLinkClick = (event: MouseEvent) => {
      if (cart.length === 0 || isNavigationBlocked) return

      const target = event.target as HTMLElement
      const link = target.closest('a')
      
      if (link && !link.href.includes('/sales') && link.target !== '_blank') {
        // Prevent all types of navigation
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()
        
        // Store the intended destination
        pendingNavigation = link.href
        
        showCartWarning(
          `You have ${cart.length} item(s) in your cart. If you navigate away, your cart will be cleared and you'll lose these items.`,
          async () => {
            // User confirmed - clear cart and navigate
            setCart([])
            setSelectedQuantities({})
            // Clear cart from database
            await clearCartFromAPI()
            closeCartWarning()
            // Navigate to the intended destination
            if (pendingNavigation) {
              setTimeout(() => {
                window.location.href = pendingNavigation!
                pendingNavigation = null
              }, 100) // Small delay to ensure modal closes
            }
          },
          () => {
            // User cancelled - just close modal and clear pending navigation
            closeCartWarning()
            pendingNavigation = null
          }
        )
        
        return false // Extra prevention
      }
    }

    // Also handle programmatic navigation attempts
    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function(state, title, url) {
      if (cart.length > 0 && url && !url.toString().includes('/sales') && !isNavigationBlocked) {
        showCartWarning(
          `You have ${cart.length} item(s) in your cart. If you navigate away, your cart will be cleared and you'll lose these items.`,
          () => {
            // User confirmed - clear cart and navigate
            setCart([])
            setSelectedQuantities({})
            closeCartWarning()
            setTimeout(() => {
              originalPushState.call(window.history, state, title, url)
            }, 100)
          },
          () => {
            // User cancelled - just close modal
            closeCartWarning()
          }
        )
        return
      }
      originalPushState.call(window.history, state, title, url)
    }

    // Add event listener with capture to catch events early
    document.addEventListener('click', handleLinkClick, true)

    return () => {
      document.removeEventListener('click', handleLinkClick, true)
      // Restore original functions
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
    }
  }, [cart, isNavigationBlocked])


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
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      params.append('page', currentPage.toString())
      params.append('limit', productsPerPage.toString())
      params.append('includeCart', 'true') // Include cart data for accurate availability
      
      const response = await fetch(`/api/products?${params}`)
      const data = await response.json()
      setProducts(data.products || [])
      setTotalPages(data.totalPages || 1)
      setTotalProducts(data.total || 0)
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
      // Temporarily use local cart only to avoid API errors
      const existingItem = cart.find(item => item.product._id === product._id)
      const currentCartQuantity = existingItem ? existingItem.quantity : 0
      const availableStock = product.availableQuantity || product.quantity || 0
      
      // Check if we can add the requested quantity
      if (currentCartQuantity + quantity > availableStock) {
        error(`Cannot add ${quantity} items of ${product.name}. Available stock: ${availableStock - currentCartQuantity}`)
        return
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
      
      // Reset selected quantity for this product
      setSelectedQuantities(prev => ({
        ...prev,
        [product._id]: 1
      }))
      
      // Availability will be calculated automatically based on cart state
      
      // Broadcast cart update to other clients via WebSocket
      broadcastCartUpdate(product._id, 'reserve', quantity)
      
    } catch (err) {
      error('Failed to add item to cart. Please try again.')
    } finally {
      setAddingToCart(null)
    }
  }

  const updateCartQuantity = async (productId: string, newQuantity: number) => {
    const item = cart.find(item => item.product._id === productId)
    
    try {
      // Temporarily use local cart only to avoid API errors
      if (newQuantity <= 0) {
        setCart(cart.filter(item => item.product._id !== productId))
        // Reset selected quantity when item is removed
        setSelectedQuantities(prev => ({
          ...prev,
          [productId]: 1
        }))
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
          return
        }
      }
      
      // Availability will be calculated automatically based on cart state
      
    } catch (err) {
      error('Failed to update cart. Please try again.')
    }
  }

  const removeFromCart = (productId: string) => {
    const item = cart.find(item => item.product._id === productId)
    if (item) {
      showConfirmation(
        'Remove Item',
        `Are you sure you want to remove "${item.product.name}" from your cart?`,
        () => {
          // Temporarily use local cart only to avoid API errors
          setCart(cart.filter(item => item.product._id !== productId))
          // Reset selected quantity when item is removed
          setSelectedQuantities(prev => ({
            ...prev,
            [productId]: 1
          }))
          info(`${item.product.name} removed from cart`)
          
          // Broadcast cart update to release the reserved quantity
          broadcastCartUpdate(productId, 'release', item.quantity)
          
          // Refresh products to get updated availability
          fetchProducts()
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
        // Broadcast cart updates to release all reserved quantities
        cart.forEach(item => {
          broadcastCartUpdate(item.product._id, 'release', item.quantity)
        })
        
        // Temporarily use local cart only to avoid API errors
        setCart([])
        // Reset all selected quantities
        setSelectedQuantities({})
        info('Cart cleared')
        
        // Refresh products to get updated availability
        fetchProducts()
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

  const getActualAvailableQuantity = (product: Product) => {
    // Calculate based on local cart state and other cashiers' reservations
    const cartItem = cart.find(item => item.product._id === product._id)
    const localCartQuantity = cartItem ? cartItem.quantity : 0
    
    // Get reservations from other cashiers
    const otherCashiersQuantity = otherCashiersReservations[product._id] || 0
    
    // Use the base quantity from the product and subtract all reservations
    const baseQuantity = product.totalQuantity || product.quantity || 0
    const totalReserved = localCartQuantity + otherCashiersQuantity
    
    return Math.max(0, baseQuantity - totalReserved)
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
        
        // Broadcast cart updates to release all reserved quantities (sale completed)
        cart.forEach(item => {
          broadcastCartUpdate(item.product._id, 'release', item.quantity)
        })
        
        setCart([])
        
        // Reset all selected quantities
        setSelectedQuantities({})
        
        // Clear cart from database
        await clearCartFromAPI()
        
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
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Sales & Checkout</h1>
              <div className="mt-1 flex items-center gap-4">
                <p className="text-sm text-gray-600 dark:text-slate-400">Add products to cart and process sales</p>
                {/* Real-time sync status - moved to left side under subtitle */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <span className="text-xs text-slate-400">
                    {isWebSocketConnected ? 'Multi-cashier sync active' : 'Multi-cashier sync offline'}
                  </span>
                </div>
              </div>
            </div>
            {/* Empty space to ensure cart button doesn't overlap */}
            <div className="w-16 sm:w-20"></div>
          </div>

        {/* Cart Icon Button */}
        <div className="fixed top-4 right-4 z-30">
          <button
            onClick={() => setCartModalOpen(true)}
            className="relative bg-blue-600 hover:bg-blue-700 text-white p-3 sm:p-4 rounded-full shadow-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            aria-label="Open shopping cart"
          >
            {/* Shopping Cart Icon */}
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13l-1.1 5m0 0h9.1M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
            </svg>
            
            {/* Cart Count Badge */}
            {cart.length > 0 && (
              <div className="absolute -top-1 -right-1 sm:-top-2 sm:-right-2 bg-red-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-xs font-bold min-w-[1rem] sm:min-w-[1.25rem]">
                {cart.length > 99 ? '99+' : cart.length}
              </div>
            )}
          </button>
          
          {/* Cart Total (shown when items in cart) */}
          {cart.length > 0 && (
            <div className="absolute top-12 sm:top-14 right-0 bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 px-2 py-1 rounded-lg shadow-lg text-xs sm:text-sm font-medium border border-gray-200 dark:border-slate-700 whitespace-nowrap">
              ₱{cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toFixed(2)}
            </div>
          )}
        </div>

        {/* Enhanced Search Section */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex items-center justify-between gap-4">
            {/* Search Bar */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder="Search products by name or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 placeholder-gray-400 dark:placeholder-slate-500 shadow-sm"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center group"
                    title="Clear search"
                  >
                    <svg className="h-5 w-5 text-gray-400 dark:text-slate-500 group-hover:text-gray-600 dark:group-hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
              {searchTerm && (
                <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                  Searching for "{searchTerm}"...
                </p>
              )}
            </div>
            
            {/* Connection Status and Actions */}
            <div className="flex items-center gap-3">
              {/* WebSocket Connection Status */}
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg border border-gray-200 dark:border-slate-600">
                <div 
                  className={`w-2.5 h-2.5 rounded-full ${
                    isWebSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
                  }`}
                  title={isWebSocketConnected ? 'Connected to real-time updates' : 'Disconnected from real-time updates'}
                />
                <span className={`text-sm font-medium ${
                  isWebSocketConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {isWebSocketConnected ? 'Live' : 'Offline'}
                </span>
              </div>
              
              {/* Quick Stats */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <svg className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {totalProducts} total products
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
          {loading ? (
            <div className="p-8 text-center text-gray-600 dark:text-slate-400">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                Loading products...
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              <div className="flex flex-col items-center gap-3">
                <svg className="h-12 w-12 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <div>
                  <p className="text-lg font-medium">No products found</p>
                  <p className="text-sm">{searchTerm ? 'Try a different search term.' : 'Add products first!'}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Products Grid - 4 columns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 p-8">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="group relative bg-white dark:bg-slate-800 rounded-xl shadow-sm hover:shadow-lg border border-gray-100 dark:border-slate-700 overflow-hidden transition-all duration-300 hover:-translate-y-1"
                >
                  {/* Stock Status Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    {getActualAvailableQuantity(product) === 0 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                        </svg>
                        Sold Out
                      </span>
                    ) : getActualAvailableQuantity(product) <= 5 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Only {getActualAvailableQuantity(product)} left
                      </span>
                    ) : getActualAvailableQuantity(product) <= 10 ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        {getActualAvailableQuantity(product)} available
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        In Stock
                      </span>
                    )}
                  </div>

                  {/* Product Image - Complete image visible */}
                  <div className="mb-4 bg-gray-50 dark:bg-slate-600 rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
                    <div className="w-full h-32 sm:h-40 flex items-center justify-center p-2">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="max-w-full max-h-full object-contain cursor-pointer hover:opacity-80 transition-opacity rounded"
                        onClick={() => openImageModal(getProductImage(product), product.name)}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/products/default.svg'
                        }}
                      />
                    </div>
                  </div>

                  {/* Product Info */}
                  <div className="p-4 space-y-3">
                    {/* Product Name & Category */}
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-slate-100 text-lg leading-tight line-clamp-2 mb-1">
                        {product.name}
                      </h3>
                      {(product.description || product.category) && (
                        <p className="text-sm text-gray-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {product.description || product.category}
                        </p>
                      )}
                    </div>
                    
                    {/* Price & Availability */}
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          ₱{product.price.toFixed(2)}
                        </span>
                        <div className="flex items-center mt-1">
                          <div className={`w-2 h-2 rounded-full mr-2 ${
                            getActualAvailableQuantity(product) === 0 
                              ? 'bg-red-500' 
                              : getActualAvailableQuantity(product) <= 5 
                              ? 'bg-orange-500' 
                              : 'bg-green-500'
                          }`}></div>
                          <span className={`text-sm font-medium ${
                            getActualAvailableQuantity(product) === 0 
                              ? 'text-red-600 dark:text-red-400' 
                              : getActualAvailableQuantity(product) <= 5 
                              ? 'text-orange-600 dark:text-orange-400' 
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {getActualAvailableQuantity(product) === 0 
                              ? 'Out of Stock' 
                              : `${getActualAvailableQuantity(product)} in stock`
                            }
                          </span>
                        </div>
                      </div>
                      
                      {/* Cart & Reservation Status */}
                      <div className="text-right">
                        {cart.find(item => item.product._id === product._id) && (
                          <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400 text-xs mb-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                            </svg>
                            {cart.find(item => item.product._id === product._id)?.quantity} in cart
                          </div>
                        )}
                        {otherCashiersReservations[product._id] > 0 && (
                          <div className="flex items-center gap-1 text-red-600 dark:text-red-400 text-xs">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            {otherCashiersReservations[product._id]} reserved
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Quantity Selector & Add to Cart */}
                    <div className="space-y-3 pt-2 border-t border-gray-100 dark:border-slate-600">
                      {/* Quantity Selector */}
                      <div className="flex items-center justify-center">
                        <div className="flex items-center bg-gray-50 dark:bg-slate-700 rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
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
                            disabled={getActualAvailableQuantity(product) === 0}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <div className="px-4 py-2 min-w-[60px] text-center">
                            <input
                              type="number"
                              min="1"
                              max={getActualAvailableQuantity(product)}
                              value={selectedQuantities[product._id] || 1}
                              onChange={(e) => {
                                const maxAvailable = getActualAvailableQuantity(product)
                                const value = Math.max(1, Math.min(
                                  parseInt(e.target.value) || 1,
                                  maxAvailable
                                ))
                                setSelectedQuantities(prev => ({
                                  ...prev,
                                  [product._id]: value
                                }))
                              }}
                              disabled={getActualAvailableQuantity(product) === 0}
                              className="w-full text-center border-0 bg-transparent text-gray-900 dark:text-slate-100 focus:outline-none font-medium disabled:opacity-50"
                            />
                          </div>
                          <button
                            onClick={() => {
                              const currentQty = selectedQuantities[product._id] || 1
                              const maxQty = getActualAvailableQuantity(product)
                              if (currentQty < maxQty) {
                                setSelectedQuantities(prev => ({
                                  ...prev,
                                  [product._id]: currentQty + 1
                                }))
                              }
                            }}
                            disabled={getActualAvailableQuantity(product) === 0}
                            className="p-2 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Add to Cart Button */}
                      <button
                        onClick={() => addToCart(product, selectedQuantities[product._id] || 1)}
                        disabled={getActualAvailableQuantity(product) === 0 || addingToCart === product._id}
                        className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                          getActualAvailableQuantity(product) === 0
                            ? 'bg-gray-200 dark:bg-slate-600 text-gray-500 dark:text-slate-400 cursor-not-allowed'
                            : addingToCart === product._id
                            ? 'bg-blue-500 text-white cursor-wait'
                            : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98]'
                        }`}
                      >
                        {addingToCart === product._id ? (
                          <div className="flex items-center justify-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                            Adding to Cart...
                          </div>
                        ) : getActualAvailableQuantity(product) === 0 ? (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                            </svg>
                            {cart.find(item => item.product._id === product._id) ? 'All in Cart' : 'Out of Stock'}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13l-1.1 5m0 0h9.1M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                            Add {selectedQuantities[product._id] || 1} to Cart
                          </div>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="border-t border-gray-200 dark:border-slate-600 px-4 py-4">
                  <div className="flex items-center justify-between">
                    {/* Page Info */}
                    <div className="text-sm text-gray-600 dark:text-slate-400">
                      Showing {((currentPage - 1) * productsPerPage) + 1} to {Math.min(currentPage * productsPerPage, totalProducts)} of {totalProducts} products
                    </div>
                    
                    {/* Pagination Buttons */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="First page"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Previous page"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      
                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {(() => {
                          const pages = []
                          const maxVisiblePages = 5
                          let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2))
                          let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1)
                          
                          // Adjust start page if we're near the end
                          if (endPage - startPage + 1 < maxVisiblePages) {
                            startPage = Math.max(1, endPage - maxVisiblePages + 1)
                          }
                          
                          for (let i = startPage; i <= endPage; i++) {
                            pages.push(
                              <button
                                key={i}
                                onClick={() => setCurrentPage(i)}
                                className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                  i === currentPage
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-700 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                                }`}
                              >
                                {i}
                              </button>
                            )
                          }
                          return pages
                        })()}
                      </div>
                      
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Next page"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-2 text-sm font-medium text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Last page"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
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

        {/* Cart Modal */}
        <Modal 
          isOpen={cartModalOpen} 
          onClose={() => setCartModalOpen(false)}
          title="Shopping Cart"
          size="lg"
        >
          <div className="space-y-6">
            {/* Customer Name Field */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                Customer Name
              </label>
              <input
                type="text"
                placeholder="Enter customer name (optional)"
                value={saleData.customerName}
                onChange={(e) => setSaleData({ ...saleData, customerName: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {cart.length === 0 ? (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-300 dark:text-slate-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13l-1.1 5m0 0h9.1M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
                </svg>
                <p className="text-gray-500 dark:text-slate-400 text-lg">Your cart is empty</p>
                <p className="text-gray-400 dark:text-slate-500 text-sm mt-2">Add some products to get started</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Cart Items */}
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {cart.map((item) => (
                    <div key={item.product._id} className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-slate-700 rounded-lg">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-slate-100 text-lg">{item.product.name}</h4>
                        <p className="text-gray-600 dark:text-slate-400">₱{item.product.price.toFixed(2)} each</p>
                      </div>
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => updateCartQuantity(item.product._id, item.quantity - 1)}
                          className="w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          -
                        </button>
                        <span className="w-12 text-center text-gray-900 dark:text-slate-100 font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.product._id, item.quantity + 1)}
                          className="w-8 h-8 flex items-center justify-center border border-gray-300 dark:border-slate-600 rounded-lg text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors"
                        >
                          +
                        </button>
                        <button
                          onClick={() => removeFromCart(item.product._id)}
                          className="ml-2 p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Checkout Form */}
                <div className="border-t border-gray-200 dark:border-slate-600 pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Tax (₱)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={saleData.tax}
                        onChange={(e) => setSaleData({ ...saleData, tax: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Discount (₱)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={saleData.discount}
                        onChange={(e) => setSaleData({ ...saleData, discount: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Payment</label>
                      <select
                        value={saleData.paymentStatus}
                        onChange={(e) => setSaleData({ ...saleData, paymentStatus: e.target.value as any })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Amount Paid *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={total}
                        step="0.01"
                        value={saleData.amountPaid === 0 ? '' : saleData.amountPaid}
                        onChange={(e) => {
                          const value = e.target.value
                          setSaleData({ 
                            ...saleData, 
                            amountPaid: value === '' ? 0 : parseFloat(value) || 0 
                          })
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                        placeholder="Enter amount received"
                        required
                      />
                      <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                        Remaining: ₱{Math.max(0, total - saleData.amountPaid).toFixed(2)}
                      </p>
                    </div>
                  )}

                  {/* Due Date (for partial and pending payments) */}
                  {(saleData.paymentStatus === 'partial' || saleData.paymentStatus === 'pending') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                        Due Date
                      </label>
                      <input
                        type="date"
                        value={saleData.dueDate}
                        onChange={(e) => setSaleData({ ...saleData, dueDate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {/* Cashier Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                      Cashier *
                    </label>
                    <select
                      value={selectedCashier}
                      onChange={(e) => setSelectedCashier(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
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
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <p className="text-sm text-yellow-800 dark:text-yellow-300">
                          Customer name is required for credit sales. Please enter it above.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Total and Actions */}
                  <div className="border-t border-gray-200 dark:border-slate-600 pt-4">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xl font-semibold text-gray-900 dark:text-slate-100">Total:</span>
                      <span className="text-xl font-bold text-blue-600 dark:text-blue-400">₱{total.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={clearCart}
                        className="sm:flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-3 rounded-lg font-medium transition-colors order-2 sm:order-1"
                      >
                        Clear Cart
                      </button>
                      <button
                        onClick={() => {
                          setCartModalOpen(false)
                          handleCheckout()
                        }}
                        disabled={processing}
                        className="sm:flex-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors order-1 sm:order-2"
                      >
                        {processing ? (
                          <div className="flex items-center justify-center">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                            Processing...
                          </div>
                        ) : (
                          'Checkout'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* Cart Warning Modal */}
        <Modal 
          isOpen={cartWarningModal.isOpen} 
          onClose={() => {}} // Disable closing by clicking outside
          title="Cart Items Pending"
          size="md"
          showCloseButton={false} // Disable X button
        >
          <div className="space-y-6">
            {/* Warning Icon */}
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>

            {/* Cart Summary */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                You have {cart.length} item(s) in your cart
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                {cartWarningModal.message}
              </p>
              
              {/* Cart Items Summary */}
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <div className="space-y-2">
                  {cart.slice(0, 3).map((item) => (
                    <div key={item.product._id} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-slate-300">{item.product.name}</span>
                      <span className="text-gray-600 dark:text-slate-400">x{item.quantity}</span>
                    </div>
                  ))}
                  {cart.length > 3 && (
                    <div className="text-sm text-gray-500 dark:text-slate-500">
                      ...and {cart.length - 3} more item(s)
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 dark:border-slate-600 pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>₱{cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={cartWarningModal.onCancel}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors font-medium"
              >
                Stay on Sales Page
              </button>
              <button
                onClick={cartWarningModal.onConfirm}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                Clear Cart & Continue
              </button>
            </div>
          </div>
        </Modal>

        {/* Refresh Warning Modal */}
        <Modal 
          isOpen={refreshWarningModal.isOpen} 
          onClose={() => {}} // Disable closing by clicking outside
          title="Refresh Page Warning"
          size="md"
          showCloseButton={false} // Disable X button
        >
          <div className="space-y-6">
            {/* Refresh Icon */}
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
            </div>

            {/* Warning Content */}
            <div className="text-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                Are you sure you want to refresh?
              </h3>
              <p className="text-gray-600 dark:text-slate-400 mb-4">
                You have {cart.length} item(s) in your cart. If you refresh the page, your cart will be cleared and you'll lose these items.
              </p>
              
              {/* Cart Items Summary */}
              <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 mb-4">
                <div className="space-y-2">
                  {cart.slice(0, 3).map((item) => (
                    <div key={item.product._id} className="flex justify-between text-sm">
                      <span className="text-gray-700 dark:text-slate-300">{item.product.name}</span>
                      <span className="text-gray-600 dark:text-slate-400">x{item.quantity}</span>
                    </div>
                  ))}
                  {cart.length > 3 && (
                    <div className="text-sm text-gray-500 dark:text-slate-500">
                      ...and {cart.length - 3} more item(s)
                    </div>
                  )}
                </div>
                <div className="border-t border-gray-200 dark:border-slate-600 pt-2 mt-2">
                  <div className="flex justify-between font-semibold">
                    <span>Total:</span>
                    <span>₱{cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Keyboard Shortcut Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <span className="font-medium">Detected:</span> Page refresh shortcut
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                  F5, Ctrl+R, or Cmd+R
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={refreshWarningModal.onCancel}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-slate-600 text-gray-800 dark:text-slate-200 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-500 transition-colors font-medium"
              >
                Cancel Refresh
              </button>
              <button
                onClick={refreshWarningModal.onConfirm}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors font-medium"
              >
                Clear Cart & Refresh
              </button>
            </div>
          </div>
        </Modal>

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