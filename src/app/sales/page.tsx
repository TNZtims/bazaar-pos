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
  lastUpdated?: string // For forcing React re-renders
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
  const [updatedProductIds, setUpdatedProductIds] = useState<Set<string>>(new Set())
  const [newProductIds, setNewProductIds] = useState<Set<string>>(new Set())
  const [newProductsToNotify, setNewProductsToNotify] = useState<any[]>([])
  const [notifiedProductIds, setNotifiedProductIds] = useState<Set<string>>(new Set())
  // Removed pagination - showing all products
  const [totalProducts, setTotalProducts] = useState(0)
  const [processing, setProcessing] = useState(false)
  const [selectedCashier, setSelectedCashier] = useState(store?.selectedCashier || '')
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
  const [selectedImageProduct, setSelectedImageProduct] = useState<Product | null>(null)

  // Close image modal on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedImageProduct) {
        setSelectedImageProduct(null)
      }
    }

    if (selectedImageProduct) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [selectedImageProduct])
  
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

  // Debug WebSocket connection status
  useEffect(() => {
    console.log('🔗 Sales Page WebSocket Status:', {
      connected: isWebSocketConnected,
      storeId: store?.id,
      error: webSocketError,
      updatesCount: inventoryUpdates.length
    })
  }, [isWebSocketConnected, store?.id, webSocketError, inventoryUpdates.length])
  
  // Handle new product notifications separately to avoid render cycle issues
  useEffect(() => {
    if (newProductsToNotify.length > 0) {
      console.log('🔔 Sales Page: Showing notification for new products:', newProductsToNotify.map(p => p.name))
      
      // Use setTimeout to ensure this runs in the next tick to avoid any timing issues
      const timeoutId = setTimeout(() => {
        success(
          `${newProductsToNotify.length} new product${newProductsToNotify.length > 1 ? 's' : ''} added: ${newProductsToNotify.map(p => p.name).join(', ')}`,
          'New Products Available!'
        )
      }, 0)
      
      setNewProductsToNotify([]) // Clear immediately after scheduling notification
      
      return () => clearTimeout(timeoutId)
    }
  }, [newProductsToNotify]) // Removed 'success' from dependencies

  // Auto-populate cashier from login session
  useEffect(() => {
    if (store?.selectedCashier && !selectedCashier) {
      setSelectedCashier(store.selectedCashier)
    }
  }, [store?.selectedCashier, selectedCashier])

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
    if (store?.id) {
      fetchProducts()
    }
  }, [searchTerm]) // Fetch products when search changes

  // Cart API functions
  const loadCartFromAPI = async () => {
    // Capture the current store ID at the time of the request
    const requestStoreId = store?.id
    const requestStoreName = store?.storeName
    
    if (!requestStoreId) {
      console.log('⚠️ No store ID available, skipping cart load')
      return
    }
    
    try {
      // Add cache-busting to ensure fresh cart data from MongoDB
      const timestamp = Date.now()
      console.log(`🛒 Sales Page: Loading cart for store ${requestStoreName} (${requestStoreId})`)
      
      const response = await fetch(`/api/cart?_t=${timestamp}`, {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      // Check if store changed while loading cart
      if (store?.id !== requestStoreId) {
        console.log(`🚫 Sales Page: Cart load cancelled - store changed from ${requestStoreName} to ${store?.storeName}`)
        return
      }
      
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
          console.log(`✅ Sales Page: Restored ${cartItems.length} items from database for store ${requestStoreName}`)
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
          tax: 0, // Tax removed from checkout
          discount: cartData.discount || 0,
          paymentMethod: cartData.paymentMethod || 'cash',
          paymentStatus: cartData.paymentStatus || 'paid',
          amountPaid: cartData.amountPaid || 0,
          dueDate: cartData.dueDate || ''
        }))
        
        setSelectedCashier(cartData.selectedCashier || '')
      }
    } catch (error) {
      // Only log error if we're still on the same store
      if (store?.id === requestStoreId) {
        console.error('Failed to load cart from API:', error)
      } else {
        console.log(`🚫 Sales Page: Ignoring cart load error for old request (${requestStoreId})`)
      }
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
      //   tax: 0, // Tax removed from checkout
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
      //   tax: 0, // Tax removed from checkout
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

      // Detect refresh shortcuts: F5, Ctrl+R, Ctrl+Shift+R, Cmd+R, Ctrl+F5
      const isRefresh = 
        event.key === 'F5' ||
        (event.ctrlKey && event.key === 'r') ||
        (event.ctrlKey && event.shiftKey && event.key === 'R') ||
        (event.metaKey && event.key === 'r') ||
        (event.ctrlKey && event.key === 'F5') // Hard refresh

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

  // Load products on component mount and when store changes
  useEffect(() => {
    if (store?.id) {
      console.log(`🏪 Sales Page: Store changed to:`, store.id, store.storeName, 'at', new Date().toISOString())
      
      // Reset ALL state when store changes to prevent cross-store contamination
      setProducts([])
      setCart([])
      setSelectedQuantities({})
      setSearchTerm('')
      setCartLoaded(false)
      setAddingToCart(null) // Reset any ongoing operations
      setProcessing(false) // Reset processing state
      
      // Add a small delay to ensure state is fully reset before fetching new data
      setTimeout(() => {
        // Fetch products for the new store
        fetchProducts()
        
        // Load cart for the new store
        loadCartFromAPI().finally(() => {
          setCartLoaded(true)
        })
      }, 100)
    }
  }, [store?.id])

  // Apply real-time inventory updates to products
  useEffect(() => {
    console.log('🔍 Sales Page: inventoryUpdates changed:', inventoryUpdates.length, inventoryUpdates)
    if (inventoryUpdates.length > 0) {
      console.log(`📡 Sales Page: Applying ${inventoryUpdates.length} inventory updates for store:`, store?.id)
      
      // Track which products are being updated for animation
      const updatedIds = new Set<string>()
      const newIds = new Set<string>()
      
      // Handle new product creation first
      const newProducts = inventoryUpdates.filter(u => u.isNewProduct && u.productData)
      let productsToNotify: any[] = []
      
      if (newProducts.length > 0) {
        console.log('📦 Sales Page: Adding new products:', newProducts.map(p => p.productData.name))
        
        setProducts(prevProducts => {
          const existingIds = new Set(prevProducts.map(p => p._id))
          const productsToAdd = newProducts
            .filter(update => !existingIds.has(update.productData._id))
            .map(update => {
              newIds.add(update.productData._id)
              console.log('➕ Sales Page: Adding new product:', update.productData.name)
            return {
                ...update.productData,
                lastUpdated: update.timestamp
              }
            })
          
          if (productsToAdd.length > 0) {
            productsToNotify = productsToAdd // Store for notification outside state update
            return [...prevProducts, ...productsToAdd]
          }
          return prevProducts
        })
        
        // Set products to notify via separate state to trigger useEffect
        if (productsToNotify.length > 0) {
          // Filter out products that have already been notified
          const productsToNotifyFiltered = productsToNotify.filter(p => !notifiedProductIds.has(p._id))
          
          if (productsToNotifyFiltered.length > 0) {
            console.log('🔔 Sales Page: Setting products to notify:', productsToNotifyFiltered.map(p => p.name))
            setNewProductsToNotify(productsToNotifyFiltered)
            
            // Mark these products as notified
            setNotifiedProductIds(prev => {
              const newSet = new Set(prev)
              productsToNotifyFiltered.forEach(p => newSet.add(p._id))
              return newSet
            })
          }
        }
      }
      
      // Handle regular inventory updates
      setProducts(prevProducts => {
        const updatedProducts = prevProducts.map(product => {
          const update = inventoryUpdates.find(u => u.productId === product._id && !u.isNewProduct)
          if (update) {
            console.log(`📦 Sales Page: Updating ${product.name}:`)
            console.log(`  - quantity: ${product.quantity} → ${update.quantity}`)
            console.log(`  - totalQuantity: ${product.totalQuantity} → ${update.quantity}`)
            console.log(`  - availableQuantity: ${product.availableQuantity} → ${update.quantity}`)
            updatedIds.add(product._id)
            
            const updatedProduct = {
              ...product,
              quantity: update.quantity ?? product.quantity,
              totalQuantity: update.quantity ?? product.totalQuantity, // Update totalQuantity too
              availableQuantity: update.quantity ?? product.availableQuantity, // Update availableQuantity
              // Force re-render by adding timestamp
              lastUpdated: new Date().toISOString()
            }
            
            console.log(`  - Updated product:`, updatedProduct)
            return updatedProduct
          }
          return product
        })
        
        console.log('✅ Sales Page: Forcing UI re-render with updated products')
        return [...updatedProducts] // Force new array reference
      })
      
      // Set animation IDs
      setUpdatedProductIds(updatedIds)
      setNewProductIds(newIds)
      
      // Clear animations after timeout
      setTimeout(() => {
        setUpdatedProductIds(new Set())
      }, 2000)
      
      setTimeout(() => {
        setNewProductIds(new Set())
      }, 3000)
    }
  }, [inventoryUpdates, store?.id, success])

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
    // Capture the current store ID at the time of the request
    const requestStoreId = store?.id
    const requestStoreName = store?.storeName
    
    if (!requestStoreId) {
      console.log('⚠️ No store ID available, skipping product fetch')
      return
    }
    
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      // Removed pagination - fetch all products
      params.append('includeCart', 'true') // Include cart data for accurate availability
      
      // Add cache-busting timestamp to force fresh data from MongoDB
      params.append('_t', Date.now().toString())
      
      console.log(`🚀 Sales Page: Starting product fetch for store ${requestStoreName} (${requestStoreId})`)
      
      const response = await fetch(`/api/products?${params}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      const data = await response.json()
      
      // CRITICAL: Check if store has changed while we were fetching
      if (store?.id !== requestStoreId) {
        console.log(`🚫 Sales Page: RACE CONDITION DETECTED! Request was for ${requestStoreName} (${requestStoreId}) but current store is ${store?.storeName} (${store?.id}). Discarding response.`)
        return // Discard this response
      }
      
      // Validate that products belong to the current store
      if (data.products?.length > 0) {
        const invalidProducts = data.products.filter((p: any) => p.storeId !== requestStoreId)
        if (invalidProducts.length > 0) {
          console.error(`❌ Sales Page: INVALID PRODUCTS DETECTED! ${invalidProducts.length} products don't belong to store ${requestStoreId}:`, invalidProducts.map((p: any) => ({ id: p._id, name: p.name, storeId: p.storeId })))
          return // Don't set invalid products
        }
      }
      
      // Log to verify fresh data is being fetched
      console.log(`✅ Sales Page: Successfully fetched ${data.products?.length || 0} products for store ${requestStoreName} (${requestStoreId})`)
      
      // Log first few product IDs to verify they belong to the correct store
      if (data.products?.length > 0) {
        console.log(`📦 Sample products:`, data.products.slice(0, 3).map((p: any) => ({ id: p._id, name: p.name, storeId: p.storeId })))
      }
      
      setProducts(data.products || [])
      setTotalProducts(data.total || 0)
    } catch (error) {
      // Only log error if we're still on the same store
      if (store?.id === requestStoreId) {
        console.error('Error fetching products:', error)
      } else {
        console.log(`🚫 Sales Page: Ignoring error for old request (${requestStoreId}), current store is ${store?.id}`)
      }
    } finally {
      // Only update loading state if we're still on the same store
      if (store?.id === requestStoreId) {
        setLoading(false)
      }
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
    // Calculate based on local cart state only (removed other cashiers' reservations to fix double-counting)
    const cartItem = cart.find(item => item.product._id === product._id)
    const localCartQuantity = cartItem ? cartItem.quantity : 0
    
    // Use the base quantity from the product and subtract only local cart reservations
    const baseQuantity = product.totalQuantity || product.quantity || 0
    const result = Math.max(0, baseQuantity - localCartQuantity)
    
    
    return result
  }

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0)
    const total = subtotal - saleData.discount
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
        tax: 0, // Tax removed from checkout
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
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Create a Sale</h1>
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
                  {isWebSocketConnected ? `Live (${inventoryUpdates.length} updates)` : 'Offline'}
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
              {/* Products Grid - Modern Dark Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 p-8">
              {products
                .sort((a, b) => {
                  // Sort by stock status: stocked items first, then out-of-stock
                  const aInStock = getActualAvailableQuantity(a) > 0 ? 1 : 0
                  const bInStock = getActualAvailableQuantity(b) > 0 ? 1 : 0
                  return bInStock - aInStock // Descending order (1 before 0)
                })
                .map((product) => {
                const isOutOfStock = getActualAvailableQuantity(product) === 0
                
                return (
                <div
                  key={`${product._id}-${product.lastUpdated || Date.now()}`}
                  className={`relative transition-all duration-300 ease-in-out ${
                    isOutOfStock
                      ? 'bg-slate-800/50 opacity-60 cursor-not-allowed shadow-[0_1px_3px_0_rgba(0,0,0,0.3),0_1px_2px_0_rgba(0,0,0,0.2)]'
                      : 'bg-slate-800 cursor-pointer shadow-[0_1px_3px_0_rgba(0,0,0,0.3),0_1px_2px_0_rgba(0,0,0,0.2)] hover:shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4),0_4px_6px_-2px_rgba(0,0,0,0.25)] hover:-translate-y-1'
                  } ${
                    newProductIds.has(product._id)
                      ? 'animate-bounce scale-[1.05] ring-4 ring-green-400 shadow-[0_10px_25px_-3px_rgba(34,197,94,0.6),0_4px_6px_-2px_rgba(34,197,94,0.4)] bg-gradient-to-br from-slate-700 to-slate-800'
                      : updatedProductIds.has(product._id) 
                        ? 'animate-pulse scale-[1.02] ring-2 ring-blue-400 shadow-[0_10px_25px_-3px_rgba(59,130,246,0.4),0_4px_6px_-2px_rgba(59,130,246,0.25)]' 
                        : ''
                  }`}
                >
                  {/* Out of Stock Overlay */}
                  {isOutOfStock && (
                    <div className="absolute inset-0 bg-gray-900/30 flex items-center justify-center z-20">
                      <div className="bg-red-500/95 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-bold text-sm shadow-lg">
                        OUT OF STOCK
                      </div>
                    </div>
                  )}
                
                  {/* Product Image - Full Width at Top */}
                  <div 
                    className="bg-slate-700 h-48 flex items-center justify-center overflow-hidden relative cursor-pointer hover:bg-slate-600 transition-colors group"
                    onClick={() => setSelectedImageProduct(product)}
                  >
                    {/* Stock Status Badge */}
                    <div className="absolute top-3 right-3 z-10 flex flex-col gap-1 items-end">
                      {/* NEW badge for newly created products */}
                      {newProductIds.has(product._id) && (
                        <span className="px-2 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded shadow-lg animate-pulse">
                          ✨ NEW
                        </span>
                      )}
                      
                      {/* Stock status badge */}
                      {getActualAvailableQuantity(product) === 0 ? (
                        <span className="px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-lg">
                          SOLD OUT
                        </span>
                      ) : getActualAvailableQuantity(product) <= 5 ? (
                        <span className="px-2 py-1 bg-orange-500 text-white text-xs font-bold rounded shadow-lg">
                          {getActualAvailableQuantity(product)} LEFT
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-green-500 text-white text-xs font-bold rounded shadow-lg">
                          {getActualAvailableQuantity(product)} AVAILABLE
                        </span>
                      )}
                    </div>
                    
                    {/* Enlarge Icon - Shows on Hover */}
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center z-10">
                      <div className="bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                        <svg className="w-6 h-6 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                    
                    <img
                      src={getProductImage(product)}
                      alt={product.name}
                      className="max-w-full max-h-full object-contain rounded group-hover:opacity-80 transition-opacity pointer-events-none"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/products/default.svg'
                      }}
                      loading="lazy"
                    />
                  </div>

                  {/* Card Content */}
                  <div className="p-4">
                    {/* Product Name */}
                    <h3 className="text-white font-semibold text-lg mb-1 line-clamp-1">
                      {product.name}
                    </h3>

                    {/* Product Category/Description */}
                    <p className="text-slate-300 text-sm mb-3 line-clamp-1">
                      {product.description || product.category || 'Product'}
                    </p>

                    {/* Material Design Divider */}
                    <div className="border-t border-slate-600 mb-4"></div>

                    {/* Price & Stock Info */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-2xl font-bold text-blue-400">
                        ₱{product.price.toFixed(2)}
                      </div>
                      <div className="text-right">
                        <div>
                          <div className={`text-sm font-bold ${
                            getActualAvailableQuantity(product) === 0 
                              ? 'text-red-400' 
                              : getActualAvailableQuantity(product) <= 5 
                              ? 'text-orange-400' 
                              : 'text-green-400'
                          }`}>
                            {getActualAvailableQuantity(product) === 0 ? 'SOLD OUT' : `${getActualAvailableQuantity(product)} AVAILABLE`}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">
                            {getActualAvailableQuantity(product) === 0 ? 'Not available' : 'Available now'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sales-Specific Cart Status */}
                        {cart.find(item => item.product._id === product._id) && (
                      <div className="mb-4">
                          <div className="flex items-center gap-1 text-orange-400 text-xs">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
                            </svg>
                            {cart.find(item => item.product._id === product._id)?.quantity} in cart
                          </div>
                      </div>
                    )}
                  
                    {/* Quantity Selector */}
                    {(
                      <div className="flex items-center justify-center mb-4">
                        <div className="flex items-center bg-slate-700 rounded shadow-sm border border-slate-600">
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
                            className="p-2 text-white hover:bg-slate-600 rounded-l-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                            </svg>
                          </button>
                          <div className="px-4 py-2 min-w-[60px] text-center">
                            <span className="text-white font-medium">
                              {selectedQuantities[product._id] || 1}
                            </span>
                          </div>
                          <button
                            onClick={() => {
                              const currentQty = selectedQuantities[product._id] || 1
                              const maxQty = isOutOfStock ? 999 : getActualAvailableQuantity(product) // Allow higher quantities for out of stock
                              if (currentQty < maxQty) {
                                setSelectedQuantities(prev => ({
                                  ...prev,
                                  [product._id]: currentQty + 1
                                }))
                              }
                            }}
                            disabled={!isOutOfStock && (selectedQuantities[product._id] || 1) >= getActualAvailableQuantity(product)}
                            className={`p-2 rounded-r-lg transition-colors ${
                              !isOutOfStock && (selectedQuantities[product._id] || 1) >= getActualAvailableQuantity(product)
                                ? 'text-slate-500 cursor-not-allowed'
                                : 'text-white hover:bg-slate-600'
                            }`}
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Add to Cart Button */}
                    <button
                      onClick={() => !isOutOfStock && addToCart(product, selectedQuantities[product._id] || 1)}
                      disabled={isOutOfStock || addingToCart === product._id}
                      className={`w-full py-3 px-4 rounded font-medium transition-all duration-200 flex items-center justify-center gap-2 uppercase text-sm tracking-wide ${
                        isOutOfStock
                          ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                          : addingToCart === product._id
                          ? 'bg-orange-600 text-white cursor-wait shadow-[0_2px_4px_-1px_rgba(0,0,0,0.3)]'
                          : 'bg-orange-600 hover:bg-orange-700 text-white shadow-[0_2px_4px_-1px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.4)] hover:scale-[1.02]'
                      }`}
                    >
                      {isOutOfStock ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                          </svg>
                          {cart.find(item => item.product._id === product._id) ? 'All in Cart' : 'Out of Stock'}
                        </>
                      ) : addingToCart === product._id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          Adding...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13l-1.1 5m0 0h9.1M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
                          </svg>
                          Add {selectedQuantities[product._id] || 1} to Cart
                        </>
                      )}
                    </button>
                  </div>
                </div>
                )
              })}
              </div>

              {/* Product Count Info */}
              {totalProducts > 0 && (
                <div className="border-t border-gray-200 dark:border-slate-600 px-4 py-4">
                  <div className="text-sm text-gray-600 dark:text-slate-400 text-center">
                    Showing all {totalProducts} products
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                        onChange={(e) => setSaleData({ ...saleData, paymentStatus: e.target.value as 'paid' | 'partial' | 'pending' })}
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
                  F5, Ctrl+R, Ctrl+F5, or Cmd+R
                </p>
                <p className="text-xs text-blue-500 dark:text-blue-400 mt-2 italic">
                  Note: Browser refresh button shows native alert (browser security)
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

        {/* Product Image Modal */}
        {selectedImageProduct && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedImageProduct(null)}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-600">
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate pr-4">
                  {selectedImageProduct.name}
                </h3>
                <button onClick={() => setSelectedImageProduct(null)} className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all duration-200">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              
              {/* Modal Content - Landscape Layout */}
              <div className="flex flex-col lg:flex-row h-full max-h-[calc(85vh-80px)]">
                {/* Image Section - Left Side */}
                <div className="flex-1 lg:flex-[2] p-4 sm:p-6 flex items-center justify-center bg-gray-50 dark:bg-slate-900">
                  <img src={selectedImageProduct.imageUrl || '/images/products/default.svg'} alt={selectedImageProduct.name} className="max-w-full max-h-full object-contain rounded-lg shadow-lg" style={{ maxHeight: '500px' }} onError={(e) => { (e.target as HTMLImageElement).src = '/images/products/default.svg' }} />
                </div>
                
                {/* Details Section - Right Side */}
                <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-white dark:bg-slate-800">
                  <div className="space-y-6">
                    {/* Price Badge */}
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-lg font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        ₱{selectedImageProduct.price.toFixed(2)}
                      </span>
                      {selectedImageProduct.category && (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {selectedImageProduct.category}
                        </span>
                      )}
                    </div>
                    
                    {/* Product Details */}
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Product Information
                        </h4>
                        <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 space-y-2">
                          <p className="text-gray-700 dark:text-slate-300">
                            <span className="font-semibold text-gray-900 dark:text-slate-100">Name:</span> {selectedImageProduct.name}
                          </p>
                          <p className="text-gray-700 dark:text-slate-300">
                            <span className="font-semibold text-gray-900 dark:text-slate-100">Availability:</span> {getActualAvailableQuantity(selectedImageProduct)} units available
                          </p>
                          {/* Sales-Specific Information */}
                          {cart.find(item => item.product._id === selectedImageProduct._id) && (
                            <p className="text-gray-700 dark:text-slate-300">
                              <span className="font-semibold text-gray-900 dark:text-slate-100">In Cart:</span> {cart.find(item => item.product._id === selectedImageProduct._id)?.quantity} items
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {selectedImageProduct.description && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center">
                            <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            Description
                          </h4>
                          <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4">
                            <p className="text-gray-700 dark:text-slate-300 leading-relaxed">
                              {selectedImageProduct.description}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
    </ProtectedRoute>
  )
}