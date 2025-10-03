'use client'

import { useState, useEffect, useRef } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import ImageUpload from '@/components/ImageUpload'
import { deleteImageFromS3 } from '@/lib/s3'
import { useToast } from '@/contexts/ToastContext'
import { ConfirmationModal } from '@/components/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useWebSocketInventory } from '@/hooks/useWebSocketInventory'
import LoadingOverlay from '@/components/LoadingOverlay'
import WebSocketStatus from '@/components/WebSocketStatus'

interface Product {
  _id: string
  name: string
  cost?: number
  price: number
  discountPrice?: number     // Discounted price
  quantity: number           // Legacy field
  initialStock: number       // Initial stock when product was first added
  totalQuantity: number      // Total stock
  availableQuantity: number  // Available for sale
  reservedQuantity: number   // Reserved for pending orders
  availableForPreorder: boolean // Whether item is available for preorder
  description?: string
  category?: string
  sku?: string
  seller?: string            // Seller/supplier name
  imageUrl?: string
  createdAt: string
  lastUpdated?: string       // For forcing React re-renders
}

// Component for truncated description with hover functionality
interface TruncatedDescriptionProps {
  description: string
  maxLength?: number
}

function TruncatedDescription({ description, maxLength = 50 }: TruncatedDescriptionProps) {
  const [isHovered, setIsHovered] = useState(false)
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 })
  const spanRef = useRef<HTMLSpanElement>(null)
  
  const shouldTruncate = description.length > maxLength
  const displayText = shouldTruncate 
    ? `${description.substring(0, maxLength)}...` 
    : description

  const handleMouseEnter = () => {
    setIsHovered(true)
    if (spanRef.current) {
      const rect = spanRef.current.getBoundingClientRect()
      setTooltipPosition({
        top: rect.top - 10, // Position above the text
        left: rect.left
      })
    }
  }

  return (
    <div 
      className="text-sm text-slate-400 relative inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span 
        ref={spanRef}
        className={shouldTruncate ? 'cursor-help' : ''}
      >
        {displayText}
      </span>
      {shouldTruncate && isHovered && (
        <div 
          className="fixed z-[9999] bg-slate-800 border border-slate-600 rounded-lg p-3 shadow-xl max-w-sm whitespace-normal text-slate-100 pointer-events-none min-w-[200px]"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateY(-100%)'
          }}
        >
          <div className="text-sm leading-relaxed break-words">
            {description}
          </div>
          {/* Arrow pointing down to the text */}
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-300 dark:border-t-slate-600"></div>
          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-white dark:border-t-slate-800 transform translate-y-[-1px]"></div>
        </div>
      )}
    </div>
  )
}

export default function ProductsPage() {
  const { success, error } = useToast()
  const { store } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedProductIds, setUpdatedProductIds] = useState<Set<string>>(new Set())
  const [storeStatus, setStoreStatus] = useState<{ isOnline: boolean; isActive: boolean; isLocked: boolean } | null>(null)
  
  // Real-time inventory updates via WebSocket
  const { 
    updates: inventoryUpdates, 
    deletedProducts,
    isConnected: isWebSocketConnected,
    error: webSocketError,
    connectionQuality,
    reconnectAttempts
  } = useWebSocketInventory({
    storeId: store?.id || null,
    enabled: !!store?.id
  })
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
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
  
  const [formData, setFormData] = useState({
    name: '',
    cost: '',
    price: '',
    discountPrice: '', // Discount price field
    quantity: '',  // We'll still use this field name for backward compatibility 
    initialStock: '', // Initial stock field
    description: '',
    category: '',
    sku: '',
    seller: '',
    imageUrl: ''
  })

  useEffect(() => {
    fetchProducts()
  }, [searchTerm])

  // Fetch store status to determine if public store is open
  const fetchStoreStatus = async () => {
    try {
      const response = await fetch('/api/stores/status')
      if (response.ok) {
        const data = await response.json()
        setStoreStatus({ 
          isOnline: data.isOnline, 
          isActive: data.isActive,
          isLocked: data.isLocked || false // Default to false if not provided
        })
      }
    } catch (error) {
      console.error('Error fetching store status:', error)
    }
  }

  useEffect(() => {
    fetchStoreStatus()
  }, [])

  // Listen for page visibility changes and window focus to refresh store status
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('👁️ Products Page: Page became visible, refreshing store status')
        fetchStoreStatus()
      }
    }

    const handleWindowFocus = () => {
      console.log('🎯 Products Page: Window focused, refreshing store status')
      fetchStoreStatus()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleWindowFocus)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [])

  // Real-time store status updates via WebSocket
  useEffect(() => {
    if (!store?.id) {
      console.log('🔌 Products Page: No store ID available')
      return
    }
    
    console.log('🔌 Products Page: Setting up WebSocket for store status updates, store:', store.id)
    
    // Import socket.io-client dynamically
    import('socket.io-client').then(({ io }) => {
      // Get the current host and protocol for WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${window.location.protocol}//${host}`
      
      console.log('🔌 Products Page: WebSocket URL:', wsUrl)
      
      const socket = io(wsUrl, {
        transports: ['websocket', 'polling'],
        timeout: 5000,
        reconnection: true,
        reconnectionDelay: 2000,
        reconnectionAttempts: 5,
        forceNew: true
      })
      
      socket.on('connect', () => {
        console.log('🔌 Products Page: WebSocket connected for store status')
        // Join store-specific room
        socket.emit('join-store', store.id)
        console.log('🔌 Products Page: Joined store room:', store.id)
      })
      
      socket.on('connect_error', (err) => {
        console.error('🔌 Products Page: WebSocket connection error:', err)
      })
      
      socket.on('disconnect', () => {
        console.log('🔌 Products Page: WebSocket disconnected')
      })
      
      socket.on('reconnect', () => {
        console.log('🔌 Products Page: WebSocket reconnected')
        socket.emit('join-store', store.id)
      })
      
      // Listen for store status changes
      socket.on('store-status-changed', (data: { isOnline: boolean; isActive: boolean; isLocked: boolean }) => {
        console.log('🏪 Products Page: Store status changed via WebSocket:', data)
        setStoreStatus({ 
          isOnline: data.isOnline, 
          isActive: data.isActive,
          isLocked: data.isLocked || false
        })
        
        // Show notification about status change
        if (data.isOnline && !data.isLocked) {
          success('Store is now open - Product editing disabled', 'Store Status Changed')
        } else {
          success('Store is now closed - Product editing enabled', 'Store Status Changed')
        }
      })
      
      // Add periodic status check as fallback (more frequent)
      const statusCheckInterval = setInterval(async () => {
        try {
          const response = await fetch('/api/stores/status')
          if (response.ok) {
            const data = await response.json()
            setStoreStatus(prevStatus => {
              if (!prevStatus || prevStatus.isOnline !== data.isOnline || prevStatus.isActive !== data.isActive || prevStatus.isLocked !== (data.isLocked || false)) {
                console.log('🔄 Products Page: Store status updated via polling:', data)
                return { 
                  isOnline: data.isOnline, 
                  isActive: data.isActive,
                  isLocked: data.isLocked || false
                }
              }
              return prevStatus
            })
          }
        } catch (error) {
          console.error('🔄 Products Page: Error checking store status:', error)
        }
      }, 5000) // Check every 5 seconds for faster updates
      
      return () => {
        console.log('🔌 Products Page: Cleaning up WebSocket connection')
        clearInterval(statusCheckInterval)
        socket.disconnect()
      }
    })
  }, [store?.id, success])

  // Apply real-time inventory updates to products
  useEffect(() => {
    console.log('🔍 Products Page: inventoryUpdates changed:', inventoryUpdates.length, inventoryUpdates)
    if (inventoryUpdates.length > 0) {
      console.log('🔄 Products Page: Applying inventory updates:', inventoryUpdates)
      
      // Track which products are being updated for animation
      const updatedIds = new Set<string>()
      
      // Force a re-render by creating a completely new array
      setProducts(prevProducts => {
        const updatedProducts = prevProducts.map(product => {
          const update = inventoryUpdates.find(u => u.productId === product._id)
          if (update) {
            console.log(`📦 Products Page: Processing update for ${product.name}`)
            console.log(`📦 Products Page: Update data:`, update)
            updatedIds.add(product._id)
            
            // If we have full product data (from product-updated event), use it
            if (update.productData) {
              console.log(`📦 Products Page: Full product update for ${product.name}, discountPrice:`, update.productData.discountPrice)
              return {
                ...product,
                _id: product._id, // Ensure _id is preserved
                name: update.productData.name || product.name,
                price: update.productData.price !== undefined ? update.productData.price : product.price,
                discountPrice: update.productData.discountPrice !== undefined ? update.productData.discountPrice : product.discountPrice,
                cost: update.productData.cost !== undefined ? update.productData.cost : product.cost,
                quantity: update.productData.quantity !== undefined ? update.productData.quantity : (update.quantity !== undefined ? update.quantity : product.quantity),
                totalQuantity: update.productData.quantity !== undefined ? update.productData.quantity : (update.quantity !== undefined ? update.quantity : product.quantity),
                availableQuantity: update.productData.quantity !== undefined ? update.productData.quantity : (update.quantity !== undefined ? update.quantity : product.quantity),
                reservedQuantity: product.reservedQuantity || 0,
                initialStock: update.productData.initialStock !== undefined ? update.productData.initialStock : (update.initialStock !== undefined ? update.initialStock : product.initialStock),
                description: update.productData.description !== undefined ? update.productData.description : product.description,
                category: update.productData.category !== undefined ? update.productData.category : product.category,
                sku: update.productData.sku !== undefined ? update.productData.sku : product.sku,
                seller: update.productData.seller !== undefined ? update.productData.seller : product.seller,
                imageUrl: update.productData.imageUrl !== undefined ? update.productData.imageUrl : product.imageUrl,
                // Add a timestamp to force re-render
                lastUpdated: new Date().toISOString()
              }
            }
            // Otherwise, just update quantity and initialStock (legacy inventory-changed event)
            else if (update.quantity !== undefined) {
              console.log(`📦 Products Page: Quantity update for ${product.name} from ${product.quantity} to ${update.quantity}`)
              return {
                ...product,
                _id: product._id, // Ensure _id is preserved
                quantity: update.quantity,
                totalQuantity: update.quantity,
                availableQuantity: update.quantity,
                reservedQuantity: product.reservedQuantity || 0,
                initialStock: update.initialStock !== undefined ? update.initialStock : product.initialStock,
                // Add a timestamp to force re-render
                lastUpdated: new Date().toISOString()
              }
            }
          }
          return product
        })
        
        console.log('✅ Products Page: Forcing UI re-render with updated products')
        // Always return a new array to force re-render
        return [...updatedProducts]
      })
      
      // Set the updated product IDs for animation
      setUpdatedProductIds(updatedIds)
      
      // Clear the animation after 2 seconds
      setTimeout(() => {
        setUpdatedProductIds(new Set())
      }, 2000)
    }
  }, [inventoryUpdates])

  // Handle product deletions
  useEffect(() => {
    if (deletedProducts.length > 0) {
      setProducts(prevProducts => 
        prevProducts.filter(product => !deletedProducts.includes(product._id))
      )
    }
  }, [deletedProducts])

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams()
      if (searchTerm) params.append('search', searchTerm)
      params.append('limit', '50')
      
      const response = await fetch(`/api/products?${params}&_t=${Date.now()}`)
      const data = await response.json()
      setProducts(data.products || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    
    try {
      // Safety check: ensure editingProduct exists and has _id when updating
      if (editingProduct && !editingProduct._id) {
        console.error('❌ Editing product is missing _id:', editingProduct)
        error('Error: Product ID is missing. Please try again.', 'Update Failed')
        setSubmitting(false)
        return
      }

      // Additional safety check: if we're in edit mode but editingProduct is null
      if (showModal && editingProduct === null && formData.name) {
        console.error('❌ Form is in edit mode but editingProduct is null')
        error('Error: Product data is missing. Please close and reopen the edit form.', 'Update Failed')
        setSubmitting(false)
        return
      }

      // Validate required fields
      if (!formData.name || !formData.price || !formData.quantity) {
        console.error('❌ Missing required fields:', { name: formData.name, price: formData.price, quantity: formData.quantity })
        error('Error: Please fill in all required fields (Name, Price, Quantity).', 'Validation Failed')
        setSubmitting(false)
        return
      }

      // Additional check: if we're updating but editingProduct is null, this is a state inconsistency
      if (editingProduct === null && showModal) {
        console.error('❌ State inconsistency: showModal is true but editingProduct is null')
        error('Error: Form state is inconsistent. Please close and reopen the edit form.', 'State Error')
        setSubmitting(false)
        return
      }

      const productData = {
        ...formData,
        cost: formData.cost && formData.cost.trim() !== '' ? parseFloat(formData.cost) : null,
        price: parseFloat(formData.price),
        discountPrice: formData.discountPrice && formData.discountPrice.trim() !== '' ? parseFloat(formData.discountPrice) : null,
        quantity: parseInt(formData.quantity),  // Send as quantity to the API
        initialStock: formData.initialStock && formData.initialStock.trim() !== '' ? parseInt(formData.initialStock) : null // Always send initialStock, null if empty (standalone note field)
      }
      

      console.log('📦 Product data being sent:', productData)
      console.log('📦 Form data:', formData)
      console.log('📦 Editing product:', editingProduct ? 'Yes' : 'No')
      console.log('📦 Editing product _id:', editingProduct?._id)
      console.log('📦 Discount validation check:', {
        discountPrice: productData.discountPrice,
        price: productData.price,
        isDiscountLessThanPrice: productData.discountPrice ? productData.discountPrice < productData.price : 'N/A'
      })
      console.log('📦 initialStock from form:', formData.initialStock)
      console.log('📦 initialStock parsed:', formData.initialStock && formData.initialStock.trim() !== '' ? parseInt(formData.initialStock) : undefined)

      const url = editingProduct ? `/api/products/${editingProduct._id}` : '/api/products'
      const method = editingProduct ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      })

      if (response.ok) {
        const updatedProduct = await response.json()
        console.log('📥 Received updated product from API:', updatedProduct)
        
        setShowModal(false)
        setEditingProduct(null)
        setFormData({ name: '', cost: '', price: '', discountPrice: '', quantity: '', initialStock: '', description: '', category: '', sku: generateSKU(), seller: '', imageUrl: '' })
        
        // Refresh products list
        await fetchProducts()
      } else {
        const errorData = await response.json()
        console.error('❌ Error saving product:', errorData)
        error(errorData.message || 'Error saving product', 'Save Failed')
      }
    } catch (err) {
      console.error('Error saving product:', err)
      error('Error saving product', 'Save Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (product: Product) => {
    // Safety check: ensure product has _id
    if (!product || !product._id) {
      console.error('❌ Cannot edit product: missing _id', product)
      error('Error: Product data is invalid. Please try again.', 'Edit Failed')
      return
    }

    // Get the most up-to-date product data from the current products state
    const currentProduct = products.find(p => p._id === product._id) || product
    
    // Double-check that we have a valid product
    if (!currentProduct || !currentProduct._id) {
      console.error('❌ Cannot edit product: current product missing _id', currentProduct)
      error('Error: Product data is invalid. Please try again.', 'Edit Failed')
      return
    }
    
    console.log('📝 Editing product:', currentProduct.name, 'ID:', currentProduct._id)
    
    setEditingProduct(currentProduct)
    setFormData({
      name: currentProduct.name,
      cost: currentProduct.cost ? currentProduct.cost.toString() : '',
      price: currentProduct.price.toString(),
      discountPrice: currentProduct.discountPrice ? currentProduct.discountPrice.toString() : '',
      quantity: (currentProduct.totalQuantity || currentProduct.quantity).toString(),  // Use totalQuantity if available, fallback to legacy quantity
      initialStock: (currentProduct.initialStock || currentProduct.totalQuantity || currentProduct.quantity).toString(), // Use initialStock if available, fallback to totalQuantity or quantity
      description: currentProduct.description || '',
      category: currentProduct.category || '',
      sku: currentProduct.sku || '',
      seller: currentProduct.seller || '',
      imageUrl: currentProduct.imageUrl || ''
    })
    setShowModal(true)
  }

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

  const handleDelete = async (id: string) => {
    const product = products.find(p => p._id === id)
    if (!product) return

    showConfirmation(
      'Delete Product',
      `Are you sure you want to delete "${product.name}"?\n\nPrice: ₱${product.price.toFixed(2)}\nStock: ${product.quantity} units\n\nThis action cannot be undone.`,
      async () => {
        setDeleting(id)
        
        // Add minimum loading time to ensure loading state is visible
        const startTime = Date.now()
        const minLoadingTime = 1000 // 1 second minimum
        
        try {
          // Delete from database first
          const response = await fetch(`/api/products/${id}`, { method: 'DELETE' })
          if (response.ok) {
            // Clean up S3 image if it exists
            if (product.imageUrl) {
              try {
                await deleteImageFromS3(product.imageUrl)
              } catch (s3Error) {
                console.warn('⚠️ Failed to clean up S3 image:', s3Error)
                // Don't fail the deletion for S3 cleanup issues
              }
            }
            
            // Ensure minimum loading time has passed
            const elapsedTime = Date.now() - startTime
            if (elapsedTime < minLoadingTime) {
              await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
            }
            
            closeConfirmation()
            fetchProducts()
            success('Product deleted successfully!', 'Deleted')
          } else {
            // Ensure minimum loading time even for errors
            const elapsedTime = Date.now() - startTime
            if (elapsedTime < minLoadingTime) {
              await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
            }
            error('Error deleting product', 'Delete Failed')
          }
        } catch (err) {
          console.error('Error deleting product:', err)
          // Ensure minimum loading time even for errors
          const elapsedTime = Date.now() - startTime
          if (elapsedTime < minLoadingTime) {
            await new Promise(resolve => setTimeout(resolve, minLoadingTime - elapsedTime))
          }
          error('Error deleting product', 'Delete Failed')
        } finally {
          setDeleting(null)
        }
      },
      'danger',
      deleting === id ? 'Deleting...' : 'Delete Product',
      'Keep Product'
    )
  }

  const handleStockTransfer = () => {
    const totalProducts = products.length
    const totalCurrentStock = products.reduce((sum, product) => sum + (product.quantity || 0), 0)
    
    showConfirmation(
      'Transfer Stock to Initial Stock',
      `This will transfer the current stock values to initial stock for ALL ${totalProducts} products and set current stock to 0.\n\nTotal current stock: ${totalCurrentStock} units\n\nThis action cannot be undone.`,
      async () => {
        setSubmitting(true)
        
        try {
          const response = await fetch('/api/products/transfer-stock', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          })

          if (response.ok) {
            closeConfirmation()
            fetchProducts()
            success('Stock transfer completed successfully!', 'Transfer Complete')
          } else {
            const errorData = await response.json()
            error(errorData.message || 'Error transferring stock', 'Transfer Failed')
          }
        } catch (err) {
          console.error('Error transferring stock:', err)
          error('Error transferring stock', 'Transfer Failed')
        } finally {
          setSubmitting(false)
        }
      },
      'warning',
      submitting ? 'Transferring...' : 'Transfer Stock',
      'Cancel'
    )
  }

  const generateSKU = () => {
    // Generate a random SKU in format: PRD-YYMMDD-XXXX
    const now = new Date()
    const year = now.getFullYear().toString().slice(-2)
    const month = (now.getMonth() + 1).toString().padStart(2, '0')
    const day = now.getDate().toString().padStart(2, '0')
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    
    return `PRD-${year}${month}${day}-${random}`
  }

  const getProductImage = (product: Product) => {
    // If product has custom S3 image, use it
    if (product.imageUrl && product.imageUrl.trim()) {
      return product.imageUrl
    }
    
    // Use category-based default images
    const category = product.category?.toLowerCase()
    switch (category) {
      case 'hot beverages':
      case 'cold beverages':
      case 'beverages':
        return '/images/products/beverage.svg'
      case 'main dishes':
      case 'appetizers':
      case 'breakfast':
      case 'bakery':
      case 'instant noodles':
      case 'canned goods':
        return '/images/products/food.svg'
      case 'desserts':
      case 'snacks':
      case 'candy':
        return '/images/products/snacks.svg'
      case 'household':
      case 'seasonings':
        return '/images/products/household.svg'
      default:
        return '/images/products/default.svg'
    }
  }

  const openAddModal = () => {
    setEditingProduct(null)
    setFormData({ name: '', cost: '', price: '', discountPrice: '', quantity: '', initialStock: '', description: '', category: '', sku: generateSKU(), seller: '', imageUrl: '' })
    setShowModal(true)
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 px-4 sm:px-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-100">Products</h1>
                <WebSocketStatus
                  isConnected={isWebSocketConnected}
                  connectionQuality={connectionQuality}
                  error={webSocketError}
                  reconnectAttempts={reconnectAttempts}
                />
                {/* Store Status Indicator */}
                {storeStatus && (
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    (storeStatus.isOnline && !storeStatus.isLocked)
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' 
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${
                      (storeStatus.isOnline && !storeStatus.isLocked) ? 'bg-green-500' : 'bg-red-500'
                    }`}></div>
                    <span>{(storeStatus.isOnline && !storeStatus.isLocked) ? 'Store Open' : 'Store Closed'}</span>
                    <button
                      onClick={fetchStoreStatus}
                      className="ml-1 p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded transition-colors"
                      title="Refresh store status"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-400">
                Manage your inventory
                {(storeStatus?.isOnline && !storeStatus?.isLocked) && (
                  <span className="ml-2 text-orange-600 dark:text-orange-400">
                    • Product editing disabled while store is open
                  </span>
                )}
              </p>
            </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0">
            <button
              onClick={openAddModal}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Product
            </button>
            <button
              onClick={handleStockTransfer}
              className="bg-orange-600 text-white px-4 py-2 rounded-md hover:bg-orange-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
              </svg>
              Transfer Stock
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 p-4">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <span className="text-xs text-slate-400">
                ({inventoryUpdates.length} updates)
              </span>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        <div className="bg-slate-800 rounded-lg shadow-sm border border-slate-700 max-h-[70vh] overflow-auto">
          {products.length === 0 && !loading ? (
            <div className="p-8 text-center text-slate-400">
              No products found. {searchTerm ? 'Try a different search term.' : 'Add your first product!'}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Profit
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Initial Stock
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {products.map((product) => (
                    <tr 
                      key={`${product._id}-${product.lastUpdated || Date.now()}`} 
                      className={`hover:bg-slate-700 transition-all duration-500 ${
                        updatedProductIds.has(product._id) 
                          ? 'animate-pulse scale-[1.02] bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400 shadow-lg' 
                          : ''
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center">
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            className="h-12 w-12 rounded-lg object-cover border border-gray-200 dark:border-slate-600"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '/images/products/default.svg'
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-slate-100">{product.name}</div>
                            {product.discountPrice && product.discountPrice > 0 && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                                <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                SALE
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <TruncatedDescription description={product.description} />
                          )}
                          {product.sku && (
                            <div className="text-xs text-gray-400 dark:text-slate-500">SKU: {product.sku}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                        ₱{(product.cost || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {product.discountPrice && product.discountPrice > 0 ? (
                          <div className="space-y-1">
                            <div className="text-slate-400 line-through text-xs">
                              ₱{product.price.toFixed(2)}
                            </div>
                            <div className="text-red-600 dark:text-red-400 font-semibold">
                              ₱{product.discountPrice.toFixed(2)}
                            </div>
                            <div className="text-green-600 dark:text-green-400 text-xs">
                              Save ₱{(product.price - product.discountPrice).toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <div className="text-slate-100">
                            ₱{product.price.toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {product.cost ? (
                          <span className={`${(product.price - product.cost) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ₱{(product.price - product.cost).toFixed(2)} ({(((product.price - product.cost) / product.cost) * 100).toFixed(1)}%)
                          </span>
                        ) : (
                          <span className="text-slate-400 text-sm">
                            No cost data
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full transition-all duration-500 ${
                            (product.availableQuantity || product.quantity) < 10 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' 
                              : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          } ${
                            updatedProductIds.has(product._id) 
                              ? 'animate-pulse scale-110 ring-2 ring-blue-400 shadow-lg font-bold' 
                              : ''
                          }`}>
                            {product.availableQuantity !== undefined ? product.availableQuantity : product.quantity} Available
                          </div>
                          {product.totalQuantity !== undefined && (
                            <div className="text-xs text-slate-400 mt-1">
                              Total: {product.totalQuantity}, Reserved: {product.reservedQuantity || 0}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                        {product.initialStock !== null && product.initialStock !== undefined ? product.initialStock : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                        {product.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-100">
                        {product.seller || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          disabled={(storeStatus?.isOnline === true && storeStatus?.isLocked === false)}
                          className={`inline-flex items-center gap-1 ${
                            (storeStatus?.isOnline === true && storeStatus?.isLocked === false)
                              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                              : 'text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300'
                          }`}
                          title={(storeStatus?.isOnline === true && storeStatus?.isLocked === false) ? 'Cannot edit products while public store is open' : 'Edit product'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          disabled={deleting === product._id}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {deleting === product._id ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-4 p-4">
                {products.map((product) => (
                  <div 
                    key={`${product._id}-${product.lastUpdated || Date.now()}`} 
                    className={`border border-gray-200 dark:border-slate-600 rounded-lg p-4 bg-slate-700 transition-all duration-500 ${
                      updatedProductIds.has(product._id) 
                        ? 'animate-pulse scale-[1.02] bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-400 shadow-lg' 
                        : ''
                    }`}
                  >
                    <div className="flex items-start space-x-3 mb-3">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="h-16 w-16 rounded-lg object-cover border border-gray-200 dark:border-slate-600 flex-shrink-0"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/images/products/default.svg'
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium text-slate-100 truncate">{product.name}</h3>
                          {product.discountPrice && product.discountPrice > 0 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 flex-shrink-0">
                              SALE
                            </span>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-sm text-slate-400 mt-1 line-clamp-2">{product.description}</p>
                        )}
                        {product.sku && (
                          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">SKU: {product.sku}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <span className="text-slate-400">Cost:</span>
                        <span className="ml-1 font-medium text-slate-100">₱{product.cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Price:</span>
                        {product.discountPrice && product.discountPrice > 0 ? (
                          <div className="ml-1">
                            <div className="text-slate-400 line-through text-xs">
                              ₱{product.price.toFixed(2)}
                            </div>
                            <div className="text-red-600 dark:text-red-400 font-semibold">
                              ₱{product.discountPrice.toFixed(2)}
                            </div>
                          </div>
                        ) : (
                          <span className="ml-1 font-medium text-slate-100">₱{product.price.toFixed(2)}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-400">Profit:</span>
                        <span className="ml-1 font-medium text-green-600 dark:text-green-400">₱{((product.price - (product.cost || 0))).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Stock:</span>
                        <div className="ml-1">
                          <span className={`font-medium transition-all duration-500 ${
                            (product.availableQuantity || product.quantity) > 10 ? 'text-green-600 dark:text-green-400' :
                            (product.availableQuantity || product.quantity) > 0 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          } ${
                            updatedProductIds.has(product._id) 
                              ? 'animate-pulse scale-110 font-bold drop-shadow-lg' 
                              : ''
                          }`}>
                            {product.availableQuantity !== undefined ? product.availableQuantity : product.quantity} Available
                          </span>
                          {product.totalQuantity !== undefined && (
                            <div className="text-xs text-slate-400">
                              Total: {product.totalQuantity} | Reserved: {product.reservedQuantity || 0}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-400">Seller:</span>
                        <span className="ml-1 font-medium text-slate-100">{product.seller || '-'}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                        {product.category}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          disabled={(storeStatus?.isOnline === true && storeStatus?.isLocked === false)}
                          className={`text-sm font-medium touch-manipulation px-3 py-2 inline-flex items-center gap-1 ${
                            (storeStatus?.isOnline === true && storeStatus?.isLocked === false)
                              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
                              : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'
                          }`}
                          title={(storeStatus?.isOnline === true && storeStatus?.isLocked === false) ? 'Cannot edit products while public store is open' : 'Edit product'}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          disabled={deleting === product._id}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium touch-manipulation px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {deleting === product._id ? (
                            <>
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Deleting...
                            </>
                          ) : (
                            <>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="backdrop-blur-md bg-white/95 dark:bg-slate-900/95 rounded-xl max-w-md w-full p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-100 mb-4">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Cost (₱) <span className="text-sm text-gray-500">(for profit tracking)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Price (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Discount Price (₱) <span className="text-sm text-gray-500">(optional - leave empty for no discount)</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.discountPrice}
                  onChange={(e) => {
                    const value = e.target.value
                    const price = parseFloat(formData.price)
                    const discountPrice = parseFloat(value)
                    
                    // Validation: discount price must be less than regular price
                    if (value && price && discountPrice >= price) {
                      return // Don't update if discount price is >= regular price
                    }
                    
                    setFormData({ ...formData, discountPrice: value })
                  }}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formData.discountPrice && formData.price && parseFloat(formData.discountPrice) >= parseFloat(formData.price) && (
                  <p className="text-red-500 text-xs mt-1">Discount price must be less than regular price (₱{formData.price})</p>
                )}
                {formData.discountPrice && parseFloat(formData.discountPrice) > 0 && parseFloat(formData.discountPrice) < parseFloat(formData.price) && (
                  <p className="text-green-600 text-xs mt-1">
                    Savings: ₱{(parseFloat(formData.price) - parseFloat(formData.discountPrice)).toFixed(2)} 
                    ({(((parseFloat(formData.price) - parseFloat(formData.discountPrice)) / parseFloat(formData.price)) * 100).toFixed(1)}% off)
                  </p>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Initial Stock <span className="text-sm text-gray-500">(static note - original stock amount)</span>
                  </label>
                  <input
                    type="number"
                    value={formData.initialStock}
                    onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                    placeholder="Enter original stock amount"
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Seller
                  </label>
                  <input
                    type="text"
                    value={formData.seller}
                    onChange={(e) => setFormData({ ...formData, seller: e.target.value })}
                    placeholder="Seller/supplier name"
                    className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  SKU
                </label>
                <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="flex-1 px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sku: generateSKU() })}
                      className="px-3 py-2 bg-gray-100 dark:bg-slate-600 text-slate-300 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors text-sm"
                      title="Generate new SKU"
                    >
                      🔄
                    </button>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Auto-generated SKU. Click 🔄 to generate a new one.
                </p>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Product Image <span className="text-sm text-gray-500">(optional)</span>
                </label>
                <ImageUpload
                  currentImage={formData.imageUrl}
                  onImageChange={(imageUrl) => setFormData({ ...formData, imageUrl })}
                  onImageRemove={() => setFormData({ ...formData, imageUrl: '' })}
                />
                <p className="text-xs text-slate-400 mt-2">
                  Upload an image or take a photo. Leave empty to use default category-based image.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || (editingProduct && !editingProduct._id)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {editingProduct ? 'Updating...' : 'Adding...'}
                    </>
                  ) : (
                    <>
                      {editingProduct ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      )}
                      {editingProduct ? 'Update' : 'Add'} Product
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
            loading={deleting !== null || submitting}
          />
        {/* </div> */}
      </Layout>

      {/* Loading Overlay */}
      <LoadingOverlay
        isVisible={loading}
        title="Loading Products"
        message="Fetching product inventory and details..."
        color="blue"
      />
    </ProtectedRoute>
  )
}
