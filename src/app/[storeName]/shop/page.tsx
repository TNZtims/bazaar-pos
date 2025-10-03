'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useWebSocketInventory } from '@/hooks/useWebSocketInventory'
import QRCodeModal from '@/components/QRCodeModal'
import StarRating from '@/components/StarRating'
import LoadingOverlay from '@/components/LoadingOverlay'
import WebSocketStatus from '@/components/WebSocketStatus'

interface Product {
  _id: string
  name: string
  price: number
  discountPrice?: number
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

interface StoreStatus {
  isOpen: boolean
  isOnline: boolean
  message: string
  currentHours?: { open: string, close: string, closed: boolean }
  nextOpenTime?: string
}

interface Store {
  id: string
  name: string
  status?: StoreStatus
  bannerImageUrl?: string
  logoImageUrl?: string
  qrCodes?: {
    gcash?: string
    gotyme?: string
    bpi?: string
  }
}

/**
 * Public Shop Page - Unified UI with Store-Specific Content
 * 
 * CONSISTENT ACROSS ALL STORES:
 * - UI/UX design and layout
 * - Calculations and pricing logic  
 * - Cart and checkout behavior
 * - Features and functionality
 * - Settings and configurations
 * 
 * STORE-SPECIFIC CONTENT:
 * - Products and inventory (from each store's database)
 * - Store name, banner, and logo
 * - Store-specific data and content
 */
export default function PublicShopPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([]) // Regular shopping cart
  const [preorderCart, setPreorderCart] = useState<CartItem[]>([]) // Preorder cart
  const [orders, setOrders] = useState<any[]>([]) // User's orders
  const [updatedProductIds, setUpdatedProductIds] = useState<Set<string>>(new Set())
  const [newProductIds, setNewProductIds] = useState<Set<string>>(new Set())
  const [newProductsToNotify, setNewProductsToNotify] = useState<any[]>([])
  const [confirmedReservations, setConfirmedReservations] = useState<any[]>([]) // Confirmed reservations
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [store, setStore] = useState<Store | null>(null)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [editingOrder, setEditingOrder] = useState<string | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedQuantities, setSelectedQuantities] = useState<{[productId: string]: number}>({})
  const [activeTab, setActiveTab] = useState<'shop' | 'preorder'>('shop')
  const [activeCartTab, setActiveCartTab] = useState<'cart' | 'confirmed'>('cart')
  const [storeStatus, setStoreStatus] = useState<StoreStatus | null>(null)
  const [shouldPulsePreorder, setShouldPulsePreorder] = useState(false)
  const [storeId, setStoreId] = useState<string | null>(null)
  const [userHasInteracted, setUserHasInteracted] = useState(false)
  const [storeClosed, setStoreClosed] = useState(false)
  const [selectedImageProduct, setSelectedImageProduct] = useState<Product | null>(null)
  const [showQRCodeModal, setShowQRCodeModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [feedback, setFeedback] = useState<any[]>([])
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedbackForm, setFeedbackForm] = useState({
    customerName: '',
    comment: '',
    rating: 5
  })
  const [randomFeedback, setRandomFeedback] = useState<any[]>([])
  const [feedbackPositions, setFeedbackPositions] = useState<Array<{top: string, left: string}>>([])

  // Set mounted state on client-side
  useEffect(() => {
    setMounted(true)
  }, [])

  // Fetch feedback and randomize
  useEffect(() => {
    const fetchFeedback = async () => {
      if (storeId) {
        try {
          const response = await fetch(`/api/feedback?storeId=${storeId}`)
          if (response.ok) {
            const data = await response.json()
            const allFeedback = data.feedback || []
            setFeedback(allFeedback)
            
            // Randomize and select 3 feedback items
            if (allFeedback.length > 0) {
              const shuffled = [...allFeedback].sort(() => 0.5 - Math.random())
              const selectedFeedback = shuffled.slice(0, 3)
              setRandomFeedback(selectedFeedback)
              
              // Generate random positions for each feedback item (avoiding text areas, collisions, and screen edges)
              const positions: Array<{top: string, left: string}> = []
              const minDistance = 15 // Minimum distance between bubbles in percentage
              const bubbleWidth = 350 // Maximum bubble width in pixels
              const bubbleHeight = 200 // Maximum bubble height in pixels
              
              for (let i = 0; i < selectedFeedback.length; i++) {
                let attempts = 0
                let position: {top: string, left: string}
                let isValidPosition = false
                
                while (!isValidPosition && attempts < 50) {
                  // Avoid center area where main text is (30% to 70% vertically, 25% to 75% horizontally)
                  // Also ensure bubbles don't go off-screen edges
                  const top = Math.random() < 0.5 
                    ? Math.random() * 20 + 10   // Top area: 10% to 30% (increased margin)
                    : Math.random() * 20 + 65   // Bottom area: 65% to 85% (increased margin)
                  
                  const left = Math.random() < 0.5
                    ? Math.random() * 15 + 10   // Left area: 10% to 25% (increased margin)
                    : Math.random() * 15 + 70   // Right area: 70% to 85% (increased margin)
                  
                  position = { top: `${top}%`, left: `${left}%` }
                  
                  // Check collision with existing positions
                  isValidPosition = positions.every(existingPos => {
                    const existingTop = parseFloat(existingPos.top)
                    const existingLeft = parseFloat(existingPos.left)
                    const currentTop = parseFloat(position.top)
                    const currentLeft = parseFloat(position.left)
                    
                    const distance = Math.sqrt(
                      Math.pow(currentTop - existingTop, 2) + 
                      Math.pow(currentLeft - existingLeft, 2)
                    )
                    
                    return distance >= minDistance
                  })
                  
                  // Additional check: ensure bubble doesn't extend beyond screen boundaries
                  if (isValidPosition) {
                    const currentTop = parseFloat(position.top)
                    const currentLeft = parseFloat(position.left)
                    
                    // Check if bubble would extend beyond screen edges
                    const wouldOverflowTop = currentTop < 5 // 5% margin from top
                    const wouldOverflowBottom = currentTop > 90 // 90% margin from bottom
                    const wouldOverflowLeft = currentLeft < 5 // 5% margin from left
                    const wouldOverflowRight = currentLeft > 90 // 90% margin from right
                    
                    if (wouldOverflowTop || wouldOverflowBottom || wouldOverflowLeft || wouldOverflowRight) {
                      isValidPosition = false
                    }
                  }
                  
                  attempts++
                }
                
                positions.push(position)
              }
              setFeedbackPositions(positions)
            }
          }
        } catch (error) {
          console.error('Error fetching feedback:', error)
        }
      }
    }

    fetchFeedback()
    const interval = setInterval(fetchFeedback, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [storeId])

  // Rotate random feedback every 12 seconds (matching animation duration)
  useEffect(() => {
    if (feedback.length > 3) {
      const rotateInterval = setInterval(() => {
        const shuffled = [...feedback].sort(() => 0.5 - Math.random())
        const selectedFeedback = shuffled.slice(0, 3)
        setRandomFeedback(selectedFeedback)
        
        // Generate new random positions for each feedback item (avoiding text areas, collisions, and screen edges)
        const positions: Array<{top: string, left: string}> = []
        const minDistance = 15 // Minimum distance between bubbles in percentage
        const bubbleWidth = 350 // Maximum bubble width in pixels
        const bubbleHeight = 200 // Maximum bubble height in pixels
        
        for (let i = 0; i < selectedFeedback.length; i++) {
          let attempts = 0
          let position: {top: string, left: string}
          let isValidPosition = false
          
          while (!isValidPosition && attempts < 50) {
            // Avoid center area where main text is (30% to 70% vertically, 25% to 75% horizontally)
            // Also ensure bubbles don't go off-screen edges
            const top = Math.random() < 0.5 
              ? Math.random() * 20 + 10   // Top area: 10% to 30% (increased margin)
              : Math.random() * 20 + 65   // Bottom area: 65% to 85% (increased margin)
            
            const left = Math.random() < 0.5
              ? Math.random() * 15 + 10   // Left area: 10% to 25% (increased margin)
              : Math.random() * 15 + 70   // Right area: 70% to 85% (increased margin)
            
            position = { top: `${top}%`, left: `${left}%` }
            
            // Check collision with existing positions
            isValidPosition = positions.every(existingPos => {
              const existingTop = parseFloat(existingPos.top)
              const existingLeft = parseFloat(existingPos.left)
              const currentTop = parseFloat(position.top)
              const currentLeft = parseFloat(position.left)
              
              const distance = Math.sqrt(
                Math.pow(currentTop - existingTop, 2) + 
                Math.pow(currentLeft - existingLeft, 2)
              )
              
              return distance >= minDistance
            })
            
            // Additional check: ensure bubble doesn't extend beyond screen boundaries
            if (isValidPosition) {
              const currentTop = parseFloat(position.top)
              const currentLeft = parseFloat(position.left)
              
              // Check if bubble would extend beyond screen edges
              const wouldOverflowTop = currentTop < 5 // 5% margin from top
              const wouldOverflowBottom = currentTop > 90 // 90% margin from bottom
              const wouldOverflowLeft = currentLeft < 5 // 5% margin from left
              const wouldOverflowRight = currentLeft > 90 // 90% margin from right
              
              if (wouldOverflowTop || wouldOverflowBottom || wouldOverflowLeft || wouldOverflowRight) {
                isValidPosition = false
              }
            }
            
            attempts++
          }
          
          positions.push(position)
        }
        setFeedbackPositions(positions)
      }, 12000) // Changed to 12 seconds to match animation duration
      
      return () => clearInterval(rotateInterval)
    }
  }, [feedback])

  // Close modal on Escape key
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
    connectionQuality,
    reconnectAttempts,
    broadcastCartUpdate
  } = useWebSocketInventory({
    storeId: storeId || null,
    enabled: !!storeId
  })
  
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const storeName = params.storeName as string

  // Apply real-time inventory updates to products
  useEffect(() => {
    if (inventoryUpdates.length > 0) {
      console.log(`🔄 Processing ${inventoryUpdates.length} inventory updates`);
      // Track which products are being updated for animation
      const updatedIds = new Set<string>()
      const newIds = new Set<string>()
      
      // Handle new product creation first
      const newProducts = inventoryUpdates.filter(u => u.isNewProduct && u.productData)
      let productsToNotify: any[] = []
      
      if (newProducts.length > 0) {
        console.log('📦 Public Store: Adding new products:', newProducts.map(p => p.productData.name))
        
        setProducts(prevProducts => {
          const existingIds = new Set(prevProducts.map(p => p._id))
          const productsToAdd = newProducts
            .filter(update => !existingIds.has(update.productData._id))
            .map(update => {
              newIds.add(update.productData._id)
              console.log('➕ Public Store: Adding new product:', update.productData.name)
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
          setNewProductsToNotify(productsToNotify)
        }
      }
      
      // Handle regular inventory updates
      setProducts(prevProducts => 
        prevProducts.map(product => {
          const update = inventoryUpdates.find(u => u.productId === product._id && !u.isNewProduct)
          if (update) {
            updatedIds.add(product._id)
            return {
              ...product,
              quantity: update.quantity ?? product.quantity,
              lastUpdated: update.timestamp
            }
          }
          return product
        })
      )
      
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
  }, [inventoryUpdates])
  
  // Handle new product notifications separately to avoid render cycle issues
  useEffect(() => {
    if (newProductsToNotify.length > 0) {
      setSuccessMessage(`${newProductsToNotify.length} new product${newProductsToNotify.length > 1 ? 's' : ''} available: ${newProductsToNotify.map(p => p.name).join(', ')}!`)
      setTimeout(() => setSuccessMessage(''), 3000)
      setNewProductsToNotify([]) // Clear after showing notification
    }
  }, [newProductsToNotify])

  // Check for order editing mode
  useEffect(() => {
    const editOrderId = searchParams.get('editOrder')
    if (editOrderId) {
      setEditingOrder(editOrderId)
      loadOrderForEditing(editOrderId)
    }
  }, [searchParams])

  // Fetch store information and status using store name
  const fetchStoreInfo = async () => {
    try {
      const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeName)}`, {
        cache: 'no-cache'
      })
      if (response.ok) {
        const data = await response.json()
        
        // Check if store is accessible
        if (!data.accessible) {
          // Store is closed - redirect to closed page
          router.push(`/${storeName}/closed`)
          return
        }
        
        // Store is open and accessible
        const storeData = { 
          id: data.id, 
          name: data.name, 
          status: data.status,
          bannerImageUrl: data.bannerImageUrl,
          logoImageUrl: data.logoImageUrl,
          qrCodes: data.qrCodes
        }
        setStore(storeData)
        setStoreStatus(data.status)
        setStoreId(data.id) // Set the resolved store ID for other API calls
        setStoreClosed(false) // Store is open
        
        console.log(`🏪 Frontend: Store info loaded for ${storeName} → ID: ${data.id}`)
        console.log('🎯 QR Codes loaded:', data.qrCodes)
      } else {
        setError('Store not found')
        setStoreClosed(true)
        setLoading(false)
      }
    } catch (err) {
      console.error('Error fetching store info:', err)
      setError('Failed to load store information')
      setStoreClosed(true) // Treat as closed
      setLoading(false)
    }
  }

  // Check authentication and fetch initial data
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/customer/me', {
          credentials: 'include'
        })
        
        if (!response.ok) {
          router.push(`/${storeName}/login`)
          return
        }
        
        const data = await response.json()
        setUser(data.user)
        // Preserve existing store data (especially image URLs) when updating from auth check
        setStore(prevStore => {
          if (!prevStore) {
            // If no previous store data, just set the basic data from auth
            return {
              id: data.store.id,
              name: data.store.name,
              status: undefined,
              bannerImageUrl: undefined,
              logoImageUrl: undefined
            }
          }
          // Preserve existing store data and only update basic fields from auth
          return {
            ...prevStore,
            id: data.store.id,
            name: data.store.name
          }
        })
        
        // Verify store matches URL (only if storeId is available)
        if (storeId && data.store.id !== storeId) {
          router.push(`/${storeName}/login`)
          return
        }
        
      } catch (err) {
        router.push(`/${storeName}/login`)
      }
    }
    
    // Only run auth check when storeId is available
    if (storeId) {
      checkAuth()
    }
  }, [storeId, router, storeName])

  // Page refresh/exit protection with cart cleanup
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (cart.length > 0 && userHasInteracted && mounted) {
        
        // The message to show - keep it simple for better browser compatibility
        const message = 'You have items in your cart. Are you sure you want to leave?'
        
        // Save to localStorage with session ID and timestamp
        let sessionId = sessionStorage.getItem('cartSessionId')
        if (!sessionId) {
          sessionId = `session_${crypto.randomUUID()}`
          sessionStorage.setItem('cartSessionId', sessionId)
        }
        
        const cartData = {
          sessionId: sessionId,
          timestamp: Date.now(),
          items: cart.map(item => ({
            productId: item.product._id,
            quantity: item.quantity
          }))
        }
        if (mounted) localStorage.setItem('pendingCartCleanup', JSON.stringify(cartData))
        
        // Multiple approaches for different browsers
        event.preventDefault() // Standard
        event.returnValue = message // Chrome/Edge
        
        // Try to release stock via sendBeacon (more reliable for page unload)
        for (const item of cart) {
          try {
            const data = JSON.stringify({
              productId: item.product._id,
              quantity: item.quantity,
              action: 'release'
            })
            
            // Use sendBeacon with proper content type
            const blob = new Blob([data], { type: 'application/json' })
            const success = navigator.sendBeacon('/api/products/reserve', blob)
          } catch (err) {
            console.error('Failed to release reserved stock via beacon:', err)
          }
        }
        
        // Return message for older browsers (Safari, Firefox)
        return message
      }
    }
    
    // Alternative: Use pagehide event for iOS Safari
    const handlePageHide = (event: PageTransitionEvent) => {
      if (cart.length > 0 && mounted) {
        
        // Save to localStorage with session ID and timestamp
        let sessionId = sessionStorage.getItem('cartSessionId')
        if (!sessionId) {
          sessionId = `session_${crypto.randomUUID()}`
          sessionStorage.setItem('cartSessionId', sessionId)
        }
        
        const cartData = {
          sessionId: sessionId,
          timestamp: Date.now(),
          items: cart.map(item => ({
            productId: item.product._id,
            quantity: item.quantity
          }))
        }
        if (mounted) localStorage.setItem('pendingCartCleanup', JSON.stringify(cartData))
        
        // Try sendBeacon for iOS
        for (const item of cart) {
          try {
            const data = JSON.stringify({
              productId: item.product._id,
              quantity: item.quantity,
              action: 'release'
            })
            const blob = new Blob([data], { type: 'application/json' })
            navigator.sendBeacon('/api/products/reserve', blob)
          } catch (err) {
            console.error('Failed to release via pagehide:', err)
          }
        }
      }
    }
    
    // Additional protection for page visibility changes (when user switches tabs)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && cart.length > 0 && mounted) {
        // Save cart state to localStorage with session ID and timestamp
        let sessionId = sessionStorage.getItem('cartSessionId')
        if (!sessionId) {
          sessionId = `session_${crypto.randomUUID()}`
          sessionStorage.setItem('cartSessionId', sessionId)
        }
        
        const cartData = {
          sessionId: sessionId,
          timestamp: Date.now(),
          items: cart.map(item => ({
            productId: item.product._id,
            quantity: item.quantity
          }))
        }
        if (mounted) localStorage.setItem('pendingCartCleanup', JSON.stringify(cartData))
      }
    }
    
    // Add cleanup on beforeunload (page refresh/close) and pagehide (iOS Safari)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('pagehide', handlePageHide)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // FIXED: Improved cart cleanup with session validation and expiration
    const pendingCleanup = mounted ? localStorage.getItem('pendingCartCleanup') : null
    if (pendingCleanup && mounted) {
      ;(async () => {
        try {
          const cartData = JSON.parse(pendingCleanup)
          
          // Generate or get session ID for this user
          let sessionId = mounted ? sessionStorage.getItem('cartSessionId') : null
          if (!sessionId && mounted) {
            sessionId = `session_${crypto.randomUUID()}`
            sessionStorage.setItem('cartSessionId', sessionId)
          }
          
          // Check if this cleanup data belongs to the current session
          const isSameSession = cartData.sessionId === sessionId
          
          // Check if cleanup data is recent (within 1 hour)
          const isRecent = cartData.timestamp && (Date.now() - cartData.timestamp) < (60 * 60 * 1000)
          
          // Only cleanup if it's the same session and recent
          if (isSameSession && isRecent && cartData.items) {
            console.log('🧹 Cleaning up cart from same session:', cartData.items.length, 'items')
            
            const releasePromises = cartData.items.map(async (item: any) => {
              try {
                const response = await fetch('/api/products/reserve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    productId: item.productId,
                    quantity: item.quantity,
                    action: 'release'
                  }),
                  credentials: 'include'
                })
                
                if (!response.ok) {
                  console.error(`❌ Failed to release stock for product ${item.productId}:`, await response.text())
                }
              } catch (err) {
                console.error('Failed to release reserved stock:', err)
              }
            })
            
            await Promise.allSettled(releasePromises)
          } else {
            console.log('🚫 Skipping cleanup - different session or expired data:', {
              isSameSession,
              isRecent,
              hasItems: !!cartData.items
            })
          }
          
          // Always clear the cleanup data
          if (mounted) localStorage.removeItem('pendingCartCleanup')
        } catch (err) {
          console.error('Failed to parse pending cart cleanup:', err)
          if (mounted) localStorage.removeItem('pendingCartCleanup')
        }
      })()
    }
    
    // Cleanup when component unmounts
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('pagehide', handlePageHide)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      // Only release stock if not already handled by beforeunload
      const hasPendingCleanup = localStorage.getItem('pendingCartCleanup')
      if (!hasPendingCleanup && cart.length > 0) {
        // Release stock synchronously when component unmounts (normal navigation)
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
            
            // No broadcast needed - cart operations don't affect availability
          } catch (err) {
            console.error('Failed to release reserved stock on unmount:', err)
          }
        })
      }
    }
  }, [cart, userHasInteracted, mounted])

  // Track user interaction for beforeunload (browsers require user interaction)
  useEffect(() => {
    const enableInteraction = () => {
      if (!userHasInteracted) {
        setUserHasInteracted(true)
      }
    }

    // Add interaction listeners
    document.addEventListener('click', enableInteraction, { once: true })
    document.addEventListener('keydown', enableInteraction, { once: true })
    document.addEventListener('touchstart', enableInteraction, { once: true })

    return () => {
      document.removeEventListener('click', enableInteraction)
      document.removeEventListener('keydown', enableInteraction)
      document.removeEventListener('touchstart', enableInteraction)
    }
  }, [userHasInteracted])

  // Debug function to test beforeunload (for development)
  const testBeforeUnload = () => {
    if (cart.length > 0) {
      // Manually trigger a test
      const confirmed = window.confirm('Test: You have items in your cart. Are you sure you want to leave?')
      if (confirmed) {
      } else {
      }
    } else {
    }
  }

  // Fetch store info and reset states when store name changes
  useEffect(() => {
    // Reset states when switching stores
    setError('')
    setStoreClosed(false)
    setLoading(true)
    // Don't clear products immediately - let fetchProducts handle it
    setStoreId(null) // Reset store ID to force fresh data
    
    console.log(`🔄 Store switching: Resetting state for ${storeName}`)
    fetchStoreInfo()
  }, [storeName])

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
            // Store was just closed - redirect to closed page
            router.push(`/${storeName}/closed`)
          } else {
            // Store is still open - continue normally
          }
        } else {
        }
      } catch (error) {
        // console.log(`⚠️ Unable to check store "${storeName}" status - network error`)
      }
    }

    // Start monitoring after initial load is complete
    if (!loading && !storeClosed) {
      // Check immediately (silently for first check)
      const silentCheck = async () => {
        try {
          const response = await fetch(`/api/stores/resolve/${encodeURIComponent(storeName)}`, {
            cache: 'no-cache'
          })
          
          if (response.ok) {
            const data = await response.json()
            if (!data.accessible) {
              // console.log(`🏪 Store "${storeName}" is closed - redirecting users`)
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
      
      // Cleanup interval on unmount or when store becomes closed
      return () => clearInterval(interval)
    }
  }, [loading, storeClosed, storeName, router])

  useEffect(() => {
    const fetchProducts = async () => {
      // Don't fetch products if store is closed or we have an error
      if (storeClosed || error) {
        setLoading(false)
        return
      }
      
      // Don't fetch if we don't have a storeName
      if (!storeName) {
        setLoading(false)
        return
      }
      
      console.log(`🔄 Fetching products for store: ${storeName}`)
      
      try {
        // Use store name for public access if user is not authenticated
        // Include cart data for authenticated users to get proper availability calculations
        const apiUrl = user && storeId 
          ? '/api/products'
          : `/api/products/public?store=${storeName}`
          
        // Add cache-busting to ensure fresh products from database (client-side only)
        const cacheBustUrl = typeof window !== 'undefined' 
          ? (apiUrl.includes('?') ? `${apiUrl}&_t=${Date.now()}` : `${apiUrl}?_t=${Date.now()}`)
          : apiUrl
        
        console.log(`📡 API Call: ${cacheBustUrl}`)
        
        const response = await fetch(cacheBustUrl, {
          credentials: 'include',
          cache: 'no-cache',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        })
        
        console.log(`📡 API Response: ${response.status} ${response.statusText}`)
        
        if (response.ok) {
          const data = await response.json()
          const newProducts = data.products || []
          console.log(`🛍️ Frontend: Loaded ${newProducts.length} products for store ${storeName}`)
          console.log('🔍 Products with quantities:', newProducts.map((p: any) => ({ name: p.name, quantity: p.quantity, available: p.quantity || 0 })))
          
          // Only update products if we actually got data
          if (Array.isArray(newProducts)) {
            setProducts(newProducts)
            console.log(`✅ Products state updated with ${newProducts.length} items`)
          } else {
            console.warn('⚠️ API returned non-array products data:', data)
          }
        } else if (response.status === 403) {
          const errorData = await response.json()
          setError(errorData.message || 'Store is currently closed to public access')
          setStoreClosed(true)
        } else {
          console.error('Failed to load products:', response.status, response.statusText)
          setError('Failed to load products')
        }
      } catch (err) {
        console.error('Error loading products:', err)
        setError('Failed to load products')
      } finally {
        setLoading(false)
      }
    }
    
    // Only fetch if we have the basic requirements
    if (storeName && !storeClosed && !error) {
      fetchProducts()
    }
  }, [user, storeName, storeClosed, error])

  // Refresh products function (called after order confirmation)
  const refreshProducts = async () => {
    if (storeClosed) return
    
    try {
      const apiUrl = user && storeId 
        ? '/api/products'
        : `/api/products/public?store=${storeName}`
        
      // Add cache-busting to ensure fresh products (client-side only)
      const cacheBustUrl = typeof window !== 'undefined'
        ? (apiUrl.includes('?') ? `${apiUrl}&_t=${Date.now()}` : `${apiUrl}?_t=${Date.now()}`)
        : apiUrl
      
      const response = await fetch(cacheBustUrl, {
        credentials: 'include',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        const newProducts = data.products || []
        console.log(`🔄 Frontend: Refreshed ${newProducts.length} products for store ${storeName}`)
        setProducts(newProducts)
      } else {
        console.error('Failed to refresh products:', response.status, response.statusText)
      }
    } catch (err) {
      console.error('Error refreshing products:', err)
    }
  }

  // Load cart and confirmed reservations from MongoDB when user is authenticated and products are loaded
  useEffect(() => {
    if (user && storeId && products.length > 0) {
      loadCartFromDB()
      loadConfirmedReservations()
    }
  }, [user, storeId, products])

  // Fetch user's orders (legacy - keeping for compatibility)
  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return
      
      try {
        const response = await fetch('/api/orders/public', {
          credentials: 'include'
        })
        
        if (response.ok) {
          const data = await response.json()
          setOrders(data.orders || [])
        } else {
          console.error('Failed to load orders:', response.status, response.statusText)
        }
      } catch (err) {
        console.error('Error loading orders:', err)
      }
    }
    
    fetchOrders()
  }, [user])

  // FORCE ALL PUBLIC STORES TO USE PREORDER MODE (ORANGE BUTTONS) AS THE ONLY SHOPPING EXPERIENCE
  useEffect(() => {
    setActiveTab('preorder') // Force preorder mode for ALL stores regardless of status
  }, [storeName])

  // Note: No WebSocket inventory updates - availability only changes when orders are placed

  const addToCart = async (product: Product, quantity: number = 1) => {
    // Prevent multiple rapid additions
    if (addingToCart === product._id) return
    
    setAddingToCart(product._id)
    setError('')
    setSuccessMessage('')
    
    try {
      const existingItem = cart.find(item => item.product._id === product._id)
      const currentCartQuantity = existingItem ? existingItem.quantity : 0
      
      // For regular shop items, check stock availability
      if (activeTab === 'shop') {
        const availableStock = product.quantity || 0
        
        // Check if we can add the requested quantity
        if (currentCartQuantity + quantity > availableStock) {
          const remaining = availableStock - currentCartQuantity
          if (remaining <= 0) {
            setError(`Sorry! "${product.name}" is now out of stock.`)
          } else {
            setError(`Only ${remaining} more "${product.name}" available. You already have ${currentCartQuantity} in your cart.`)
          }
          setTimeout(() => setError(''), 4000)
          return
        }
        
        // No reservation API call for regular shop - just add to local cart
        // Reservations will only happen when "Reserve Orders" is clicked
      } else if (activeTab === 'preorder') {
        // For preorder items, check stock availability before adding to cart
        const existingPreorderItem = preorderCart.find(item => item.product._id === product._id)
        const currentPreorderQuantity = existingPreorderItem ? existingPreorderItem.quantity : 0
        const availableStock = product.quantity || 0
        
        // Check if we can add the requested quantity
        if (currentPreorderQuantity + quantity > availableStock) {
          const remaining = availableStock - currentPreorderQuantity
          if (remaining <= 0) {
            setError(`Sorry! "${product.name}" is now fully reserved. No more available for preorder.`)
          } else {
            setError(`Only ${remaining} more "${product.name}" can be preordered. You already have ${currentPreorderQuantity} in your preorder list.`)
          }
          setTimeout(() => setError(''), 4000)
          return
        }
        
        // console.log('Adding to preorder cart (validated stock):', quantity, 'for product:', product.name, 'Available:', availableStock, 'Current in cart:', currentPreorderQuantity)
      }
      
      // Update local cart state based on active tab
      if (activeTab === 'preorder') {
        // Update preorder cart
        const existingPreorderItem = preorderCart.find(item => item.product._id === product._id)
        setPreorderCart(prevCart => {
          const newCart = existingPreorderItem
            ? prevCart.map(item =>
                item.product._id === product._id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              )
            : [...prevCart, { product, quantity: quantity }]
          return newCart
        })
        
        // Trigger pulse animation for preorder tab
        setShouldPulsePreorder(true)
        setTimeout(() => setShouldPulsePreorder(false), 3000) // Stop pulsing after 3 seconds
      } else {
        // Update regular cart and persist to MongoDB
      setCart(prevCart => {
        const newCart = existingItem
          ? prevCart.map(item =>
              item.product._id === product._id
                ? { ...item, quantity: item.quantity + quantity }
                : item
            )
          : [...prevCart, { product, quantity: quantity }]

        // Persist cart to MongoDB for authenticated users
        if (user && storeId) {
          const cartData = {
            items: newCart.map(item => ({
              product: item.product._id,
              productName: item.product.name,
              quantity: item.quantity,
              unitPrice: item.product.price
            }))
          }
          
          // console.log('🛒 Sending cart data to API:', cartData)
          
          fetch('/api/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
            body: JSON.stringify(cartData),
          credentials: 'include'
          }).then(response => {
        if (!response.ok) {
              console.error('❌ Cart API error:', response.status, response.statusText)
              return response.text().then(text => {
                console.error('❌ Cart API error details:', text)
              })
            }
            // console.log('✅ Cart saved successfully')
          }).catch(err => {
            console.error('Failed to save cart to database:', err)
          })
        }

        return newCart
      })
      }
      
      // Reset selected quantity for this product
      setSelectedQuantities(prev => ({
        ...prev,
        [product._id]: 1
      }))
      
      // No broadcast needed - cart operations don't affect availability
      
      // Show success message only for regular cart, not preorder
      if (activeTab !== 'preorder') {
        setSuccessMessage(`${quantity} x ${product.name} added to cart!`)
      setTimeout(() => setSuccessMessage(''), 3000)
      }
      
    } catch (err) {
      setError('Oops! Something went wrong while adding this item. Please try again.')
    } finally {
      setAddingToCart(null)
    }
  }

  const updateCartQuantity = async (productId: string, quantity: number) => {
    const currentCart = activeTab === 'preorder' ? preorderCart : cart
    const cartItem = currentCart.find(item => item.product._id === productId)
    if (!cartItem) return
    
    const quantityDiff = quantity - cartItem.quantity
    
    if (quantity <= 0) {
      // Remove from cart
      if (activeTab === 'preorder') {
        setPreorderCart(prevCart => prevCart.filter(item => item.product._id !== productId))
      } else {
        // Remove from regular cart and persist to MongoDB
      setCart(prevCart => {
        const newCart = prevCart.filter(item => item.product._id !== productId)
        
        // Persist cart to MongoDB for authenticated users
        if (user && storeId) {
          fetch('/api/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              items: newCart.map(item => ({
                product: item.product._id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPrice: item.product.price
              }))
          }),
          credentials: 'include'
          }).catch(err => {
            console.error('Failed to save cart to database:', err)
          })
        }
        
        return newCart
      })
      }
    } else {
      // Update quantity
      if (activeTab === 'preorder') {
        setPreorderCart(prevCart => 
          prevCart.map(item =>
            item.product._id === productId
              ? { ...item, quantity: quantity }
              : item
          )
        )
      } else {
        // Update regular cart quantity and persist to MongoDB
      setCart(prevCart => {
        const newCart = prevCart.map(item =>
          item.product._id === productId
            ? { ...item, quantity: quantity }
            : item
        )
        
        // Persist cart to MongoDB for authenticated users
        if (user && storeId) {
          fetch('/api/cart', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
              items: newCart.map(item => ({
                product: item.product._id,
                productName: item.product.name,
                quantity: item.quantity,
                unitPrice: item.product.price
              }))
          }),
          credentials: 'include'
          }).catch(err => {
            console.error('Failed to save cart to database:', err)
          })
        }
        
        return newCart
      })
      }
    }
  }

  const removeFromCart = async (productId: string) => {
    if (activeTab === 'preorder') {
      setPreorderCart(prevCart => prevCart.filter(item => item.product._id !== productId))
    } else {
      // Remove from regular cart and persist to MongoDB
    setCart(prevCart => {
      const newCart = prevCart.filter(item => item.product._id !== productId)
      
      // Persist cart to MongoDB for authenticated users
      if (user && storeId) {
        fetch('/api/cart', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            items: newCart.map(item => ({
              product: item.product._id,
              productName: item.product.name,
              quantity: item.quantity,
              unitPrice: item.product.price
            }))
        }),
        credentials: 'include'
        }).catch(err => {
          console.error('Failed to save cart to database:', err)
        })
      }
      
      return newCart
    })
    }
  }

  // Helper function to get effective price (discounted price if available, otherwise regular price)
  const getEffectivePrice = (product: Product) => {
    return (product.discountPrice && product.discountPrice > 0) ? product.discountPrice : product.price
  }

  const getTotalAmount = () => {
    const currentCart = activeTab === 'preorder' ? preorderCart : cart
    return currentCart.reduce((total, item) => total + (getEffectivePrice(item.product) * item.quantity), 0)
  }

  // Calculate actual available quantity for display
  const getActualAvailableQuantity = (product: Product) => {
    const currentCart = activeTab === 'preorder' ? preorderCart : cart
    const cartItem = currentCart.find(item => item.product._id === product._id)
    const localCartQuantity = cartItem ? cartItem.quantity : 0
    const baseQuantity = product.quantity || 0
    return Math.max(0, baseQuantity - localCartQuantity)
  }

  // Helper function to get status display text and colors
  const getStatusDisplay = (approvalStatus: string, paymentStatus?: string) => {
    // If there's payment status, use that for display
    if (paymentStatus) {
      switch (paymentStatus) {
        case 'paid':
          return {
            text: 'paid',
            bgColor: 'bg-green-500',
            textColor: 'text-white'
          }
        case 'partial':
          return {
            text: 'partial',
            bgColor: 'bg-blue-500',
            textColor: 'text-white'
          }
        case 'pending':
          return {
            text: 'payable',
            bgColor: 'bg-orange-500',
            textColor: 'text-white'
          }
        case 'overdue':
          return {
            text: 'overdue',
            bgColor: 'bg-red-500',
            textColor: 'text-white'
          }
      }
    }
    
    // Fallback to approval status
    switch (approvalStatus) {
      case 'pending':
        return {
          text: 'payable',
          bgColor: 'bg-orange-500',
          textColor: 'text-white'
        }
      case 'approved':
        return {
          text: 'paid',
          bgColor: 'bg-green-500', 
          textColor: 'text-white'
        }
      case 'rejected':
        return {
          text: 'rejected',
          bgColor: 'bg-red-500',
          textColor: 'text-white'
        }
      default:
        return {
          text: approvalStatus,
          bgColor: 'bg-gray-500',
          textColor: 'text-white'
        }
    }
  }


  // Load cart from MongoDB
  const loadCartFromDB = async () => {
    if (!user || !storeId) return
    
    try {
      const response = await fetch('/api/cart', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        if (data.items && data.items.length > 0) {
          // Convert cart items to local cart format
          const cartItems = data.items.map((item: any) => {
            const product = products.find(p => p._id === item.product)
            if (product) {
              return {
                product,
                quantity: item.quantity
              }
            }
            return null
          }).filter(Boolean)
          
          setCart(cartItems)
          // console.log('🛒 Cart loaded from database:', cartItems.length, 'items')
        }
      }
    } catch (err) {
      console.error('Failed to load cart from database:', err)
    }
  }

  // Load confirmed reservations from MongoDB
  const loadConfirmedReservations = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/orders/public?limit=1000', {
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        const confirmedOrders = data.orders || []
        
        // Convert orders to confirmed reservations format
        const reservations = confirmedOrders.map((order: any) => ({
          id: order._id,
          items: order.items.map((item: any) => {
            // Find matching product from current products to get image
            const matchingProduct = products.find(p => p.name === item.productName)
            return {
            productName: item.productName,
              productImage: matchingProduct?.imageUrl,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.totalPrice || (item.unitPrice * item.quantity)
            }
          }),
          totalAmount: order.totalAmount || order.finalAmount,
          status: order.status,
          approvalStatus: order.approvalStatus,
          paymentStatus: order.paymentStatus,
          amountPaid: order.amountPaid || 0,
          amountDue: order.amountDue || order.totalAmount || order.finalAmount,
          payments: order.payments || [],
          createdAt: order.createdAt
        }))
        
        // Merge with existing local reservations to avoid overwriting new ones
        setConfirmedReservations(prev => {
          const existingIds = new Set(prev.map(r => r.id))
          const newReservations = reservations.filter((r: any) => !existingIds.has(r.id))
          const merged = [...prev, ...newReservations]
          // console.log('✅ Confirmed reservations loaded from database:', reservations.length, 'from API,', prev.length, 'local, merged:', merged.length)
          return merged
        })
      }
    } catch (err) {
      console.error('Failed to load confirmed reservations from database:', err)
    }
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

  const handlePlaceOrder = () => {
    const currentCart = activeTab === 'preorder' ? preorderCart : cart
    if (currentCart.length === 0) {
      setError('Your cart is empty')
      return
    }
    setShowConfirmModal(true)
  }

  const confirmPlaceOrder = async () => {
    const currentCart = activeTab === 'preorder' ? preorderCart : cart
    if (currentCart.length === 0) return
    
    // Verify user is authenticated before placing order
    if (!user) {
      setError('You must be logged in to place orders')
      router.push(`/${storeName}/login`)
      return
    }
    
    // console.log('🔐 User authenticated for order placement:', user.name, 'ID:', user.id)
    
    setSubmitting(true)
    setError('')
    setShowConfirmModal(false)
    
    try {
      // Fetch fresh product data directly from API before reserving
      // console.log('🔄 Fetching fresh product data for stock validation...')
      let freshProducts: Product[] = []
      
      try {
        const response = await fetch(`/api/products/public?store=${storeName}`, {
          credentials: 'include'
        })
        if (response.ok) {
          const data = await response.json()
          freshProducts = data.products || []
          // console.log('✅ Fresh product data loaded:', freshProducts.length, 'products')
        } else {
          console.error('Failed to fetch fresh product data')
          setError('Unable to check product availability right now. Please try again.')
          return
        }
      } catch (err) {
        console.error('Error fetching fresh product data:', err)
        setError('Unable to check product availability right now. Please try again.')
        return
      }
      
      // First, validate all items against fresh stock data
      for (const item of currentCart) {
        const freshProduct = freshProducts.find(p => p._id === item.product._id)
        if (!freshProduct) {
          setError(`Product ${item.product.name} not found. Please refresh and try again.`)
          return
        }
        
        // Stock validation debug info
        // requestedQuantity: item.quantity,
        // cachedQuantity: item.product.quantity,
        // freshQuantity: freshProduct.quantity,
        // available: freshProduct.quantity >= item.quantity
        
        if (freshProduct.quantity < item.quantity) {
          setError(`Insufficient stock for ${item.product.name}. Available: ${freshProduct.quantity}, Requested: ${item.quantity}. Please adjust your order.`)
          return
        }
      }
      
      // Skip the reservation loop - we'll deduct stock after order creation
      // console.log('🔄 Skipping individual reservations - will deduct stock after order creation')
      
      // Now create the order
      const orderItems = currentCart.map(item => ({
        productId: item.product._id,
        quantity: item.quantity
      }))
      
      // console.log('🔄 Creating order with items:', orderItems)
      // console.log('🔄 User authenticated:', !!user, 'Store ID:', storeId)
      
      const response = await fetch('/api/orders/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          items: orderItems,
          notes: '',
          storeId: storeId // Ensure store ID is included
        }),
        credentials: 'include'
      })
      
      // console.log('📡 Raw API response status:', response.status, response.statusText)
      
      let data
      try {
        data = await response.json()
        // console.log('📝 Order API response data:', data)
      } catch (parseError) {
        console.error('❌ Failed to parse API response:', parseError)
        // console.log('📄 Raw response text:', await response.text())
        throw new Error('Invalid API response format')
      }
      
      if (response.ok) {
        // Verify we got a valid order ID from database
        const orderId = data.order?.id || data._id
        if (!orderId) {
          console.error('⚠️ Order created but no ID returned from database:', data)
          setError('Order may not have been saved properly. Please check with admin.')
          return
        }
        
        // console.log('✅ Order successfully saved to MongoDB with ID:', orderId)
        
        // Now that order is confirmed, deduct stock for all items
        // console.log('🔄 Order confirmed - now deducting stock for all items')
        for (const item of currentCart) {
          const freshProduct = freshProducts.find(p => p._id === item.product._id)!
          // console.log(`📉 Deducting ${item.quantity} units from ${freshProduct.name}`)
          
          // Use different API endpoints based on active tab
          const apiEndpoint = activeTab === 'preorder' ? '/api/preorders/reserve' : '/api/products/reserve'
          const requestBody = activeTab === 'preorder' 
            ? {
                storeId: storeId,
                productId: freshProduct._id,
                quantity: item.quantity,
                action: 'reserve'
              }
            : {
                productId: freshProduct._id,
                quantity: item.quantity,
                action: 'reserve'
              }
          
          try {
            const reserveResponse = await fetch(apiEndpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(requestBody),
              credentials: 'include'
            })
            
            if (!reserveResponse.ok) {
              const reserveData = await reserveResponse.json()
              console.error('⚠️ Stock deduction failed after order creation:', {
                product: freshProduct.name,
                quantity: item.quantity,
                error: reserveData
              })
              // Note: Order is already created, so we log the error but don't fail the whole process
            } else {
              // console.log(`✅ Stock deducted successfully for ${freshProduct.name}`)
              
              // Broadcast the inventory change via WebSocket for preorders
              if (activeTab === 'preorder') {
                broadcastCartUpdate(freshProduct._id, 'reserve', item.quantity)
              }
            }
          } catch (stockError) {
            console.error('❌ Error during stock deduction:', stockError)
            // Order is already created, continue with success flow
          }
        }
        
        // Clear cart and localStorage
        if (activeTab === 'preorder') {
          setPreorderCart([])
        } else {
        setCart([])
        }
        
        // Clear any pending cleanup since order was successfully placed
        if (mounted) localStorage.removeItem('pendingCartCleanup')
        
        // Refresh products to show updated availability
        await refreshProducts()
        
        // Reload confirmed reservations from server (no local state addition to avoid duplicates)
        setTimeout(() => {
          loadConfirmedReservations()
        }, 1000) // Small delay to ensure database write is complete
        
        setSuccessMessage('Reservation confirmed! Waiting for admin approval.')
        setTimeout(() => setSuccessMessage(''), 3000)
      } else {
        console.error('❌ Order API failed:', { status: response.status, data })
        setError(data.message || 'Unable to complete your order right now. Please try again.')
      }
    } catch (err) {
      setError('Something went wrong while placing your order. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/customer/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } finally {
      router.push(`/${storeName}/login`)
    }
  }

  const filteredProducts = products.filter(product => {
    // Filter by search term
    const matchesSearch = product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(search.toLowerCase()))
    
    // Filter by tab
    if (activeTab === 'shop') {
      // Show all products (including sold out ones) - they'll be styled as disabled
      return matchesSearch
    } else {
      // Show all products in preorder mode (including out of stock ones)
      // Out of stock products will be styled as disabled but still visible
      return matchesSearch
    }
  }).sort((a, b) => {
    // Sort by stock status: stocked items first, then out-of-stock items
    const aInStock = (a.quantity || 0) > 0
    const bInStock = (b.quantity || 0) > 0
    
    // If both have same stock status, maintain original order
    if (aInStock === bInStock) {
      return 0
    }
    
    // In-stock items come first (return -1 if a is in stock and b is not)
    return aInStock ? -1 : 1
  })

  // Debug logging
  console.log('🔍 Debug - All products:', products.length)
  console.log('🔍 Debug - Filtered products:', filteredProducts.length)
  console.log('🔍 Debug - Out of stock products:', products.filter((p: any) => (p.quantity || 0) === 0).map((p: any) => ({ name: p.name, quantity: p.quantity })))
  console.log('🔍 Debug - Active tab:', activeTab)
  console.log('🔍 Debug - Search term:', search)
  console.log('🔍 Debug - Sorted products (first 5):', filteredProducts.slice(0, 5).map((p: any) => ({ name: p.name, quantity: p.quantity, inStock: (p.quantity || 0) > 0 })))

  // Determine if store is online for shopping
  const isStoreOnlineForShopping = storeStatus && storeStatus.isOnline

  // Feedback functions
  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!storeId || !feedbackForm.customerName || !feedbackForm.comment) return

    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId,
          customerName: feedbackForm.customerName,
          comment: feedbackForm.comment,
          rating: feedbackForm.rating
        })
      })

      if (response.ok) {
        setFeedbackForm({ customerName: '', comment: '', rating: 5 })
        setShowFeedbackForm(false)
        // Refresh feedback
        const feedbackResponse = await fetch(`/api/feedback?storeId=${storeId}`)
        if (feedbackResponse.ok) {
          const data = await feedbackResponse.json()
          setFeedback(data.feedback || [])
        }
      }
    } catch (error) {
      console.error('Error submitting feedback:', error)
    }
  }


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Store Banner */}
      <div 
        className={`relative ${
          (store?.bannerImageUrl && store.bannerImageUrl !== 'null' && store.bannerImageUrl !== '' && store.bannerImageUrl !== null) 
            ? '' 
            : 'bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-800 dark:to-purple-800'
        }`}
        style={(store?.bannerImageUrl && store.bannerImageUrl !== 'null' && store.bannerImageUrl !== '' && store.bannerImageUrl !== null) ? {
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url("${store.bannerImageUrl}")`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          minHeight: '200px'
        } : {}}
      >
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          {/* Random Position Glass-like Feedback Bubbles */}
          {randomFeedback.length > 0 && feedbackPositions.length > 0 && (
            <>
              {randomFeedback.map((item, index) => (
                <div
                  key={`${item._id}-${index}`}
                  className="absolute z-20 bg-white/5 dark:bg-slate-800/5 backdrop-blur-md rounded-3xl p-4 shadow-2xl border border-white/10 dark:border-slate-700/15 min-w-[300px] max-w-[350px] animate-fade-in-out"
                  style={{
                    top: feedbackPositions[index]?.top || '50%',
                    left: feedbackPositions[index]?.left || '50%',
                    transform: 'translate(-50%, -50%)',
                    animationDelay: `${index * 0.5}s`
                  }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500/80 to-purple-500/80 backdrop-blur-sm rounded-full flex items-center justify-center border border-white/30">
                      <span className="text-white text-sm font-bold">
                        {item.customerName.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-white/90">
                        {item.customerName}
                      </span>
                      <div className="flex text-yellow-400 mt-1">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-3 h-3 ${i < item.rating ? 'fill-current' : 'text-white/30'}`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed line-clamp-3">
                    "{item.comment}"
                  </p>
                </div>
              ))}
            </>
          )}


          {/* Top Bar with Customer Info and Logout */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4 sm:mb-6">
            <div className="text-center sm:text-left mb-4 sm:mb-0">
              <div className="text-blue-100 dark:text-blue-200 text-sm sm:text-base font-medium">
                Welcome back,
              </div>
              <div className="text-white text-lg sm:text-xl font-semibold">
                {user?.name || 'Guest'}
              </div>
            </div>
            
              <button
                onClick={logout}
              className="self-center sm:self-start bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-all duration-200 font-medium text-sm sm:text-base backdrop-blur-sm border border-white/20 hover:border-white/30 touch-manipulation"
              >
              <svg className="w-4 h-4 sm:w-5 sm:h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
                Logout
              </button>
            </div>

          <div className="text-center">
            {/* Store Logo */}
            <div className="mb-3">
              <div className="inline-flex items-center justify-center w-24 h-24 bg-white dark:bg-slate-800 rounded-full shadow-lg overflow-hidden">
                {(store?.logoImageUrl && store.logoImageUrl !== 'null' && store.logoImageUrl !== '' && store.logoImageUrl !== null) ? (
                  <img 
                    src={store.logoImageUrl} 
                    alt={`${store.name} logo`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.currentTarget as HTMLImageElement
                      target.style.display = 'none'
                      // Show default icon when image fails
                      const parent = target.parentElement
                      if (parent) {
                        parent.innerHTML = `
                          <svg class="w-12 h-12 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h4m6 0v1a1 1 0 11-2 0v-1m2-1V9a1 1 0 00-1-1H8a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z"></path>
                          </svg>
                        `
                      }
                    }}
                  />
                ) : (
                <svg className="w-12 h-12 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h4m6 0v1a1 1 0 11-2 0v-1m2-1V9a1 1 0 00-1-1H8a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1z" />
                </svg>
                )}
          </div>
          </div>
            
            {/* Store Name */}
            <div className="flex items-center justify-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                {store?.name || storeName} Store
              </h1>
              <WebSocketStatus
                isConnected={isWebSocketConnected}
                connectionQuality={connectionQuality}
                error={webSocketError}
                reconnectAttempts={reconnectAttempts}
              />
            </div>
            
            {/* Store Description */}
            <p className="text-blue-100 dark:text-blue-200 text-base sm:text-lg mb-4 max-w-3xl mx-auto">
              {activeTab === 'shop' 
                ? 'Welcome to our Company Bazaar Week! Browse delicious homemade foods, fresh viands, tasty snacks, and unique products from fellow colleagues and departments. Support your teammates while enjoying amazing deals!'
                : 'Get ahead of the bazaar rush! Preorder your favorite foods, viands, and special items from Company Bazaar Week. Secure the best homemade dishes and exclusive deals before they sell out!'
              }
            </p>
            
            {/* Bazaar Stats */}
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <div className="text-center">
                <div className="text-xl font-bold text-white">{products.length}+</div>
                <div className="text-blue-100 dark:text-blue-200 text-xs">Foods & Items</div>
                  </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">🍽️</div>
                <div className="text-blue-100 dark:text-blue-200 text-xs">Fresh Viands</div>
                </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">🥘</div>
                <div className="text-blue-100 dark:text-blue-200 text-xs">Homemade Dishes</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-white">🤝</div>
                <div className="text-blue-100 dark:text-blue-200 text-xs">Support Colleagues</div>
              </div>
            </div>
            
            {/* QR Code Payment Button */}
            {store?.qrCodes && (store.qrCodes.gcash || store.qrCodes.gotyme || store.qrCodes.bpi) && (
              <div className="mt-6">
                <button
                  onClick={() => setShowQRCodeModal(true)}
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 text-white px-6 py-3 rounded-lg transition-all duration-200 flex items-center gap-3 mx-auto shadow-lg hover:shadow-xl"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 011-1h2m0 0V4a1 1 0 011-1h1m0 0h2a1 1 0 011 1v1M9 7h1m4 0h1m-5.01 0h.01M12 9v.01" />
                  </svg>
                  <span className="font-semibold">View Payment QR Codes</span>
                  <div className="flex gap-1">
                    {store.qrCodes.gcash && <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded">GCash</span>}
                    {store.qrCodes.gotyme && <span className="px-2 py-1 bg-green-500 text-white text-xs rounded">GoTyme</span>}
                    {store.qrCodes.bpi && <span className="px-2 py-1 bg-red-500 text-white text-xs rounded">BPI</span>}
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Star Rating Section - Below Banner */}
      {store?.id && (
        <div className="py-6" style={{ backgroundColor: '#1D293D' }}>
          <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-center items-center gap-4">
              <StarRating 
                storeId={store.id} 
                className="justify-center"
                user={user}
              />
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full transition-all duration-200 border border-blue-500 hover:border-blue-600"
              >
                <svg className="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="flex flex-col xl:grid xl:grid-cols-5 gap-4 lg:gap-6">
          {/* Products */}
          <div className="xl:col-span-3 order-2 xl:order-1">

            {/* Products Title */}
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">
                    {activeTab === 'shop' ? 'Available Products' : 'Today\'s Menu'}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 max-w-4xl">
                    {activeTab === 'shop' 
                      ? 'Discover mouth-watering foods and viands from your colleagues during Company Bazaar Week! From homemade kakanin and freshly cooked ulam to delicious snacks and handcrafted items, everything is ready for immediate purchase and pickup.'
                      : 'Reserve the most sought-after foods and viands! Preorder popular dishes, special kakanin, fresh ulam, and exclusive items from your fellow employees to guarantee your favorites during the bazaar event.'
                    }
                  </p>
                </div>
              </div>
            </div>
            
            {/* Search */}
            <div className="mb-4 sm:mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 mb-3">
                <div className="flex items-center text-gray-600 dark:text-slate-400 sm:ml-auto">
                  <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  <span className="font-bold text-gray-900 dark:text-slate-100 mr-2 text-lg">
                    {filteredProducts.length}
                  </span>
                  <span className="text-base font-medium">
                    {filteredProducts.length === 1 ? 'item available' : 'items available'}
                  </span>
                </div>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  placeholder={`Search ${activeTab === 'shop' ? 'products' : 'preorder items'}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-800 text-gray-900 dark:text-slate-100 placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm hover:shadow-md transition-all duration-200"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  >
                    <svg className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <div className="max-w-sm mx-auto">
                    <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-slate-400 text-lg font-medium mb-2">No products found</p>
                    <p className="text-gray-400 dark:text-slate-500 text-sm">Try adjusting your search terms</p>
                  </div>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const isOutOfStock = getActualAvailableQuantity(product) === 0
                  
                  return (
                  <div
                    key={product._id}
                      className={`relative transition-all duration-300 ease-in-out flex flex-col ${
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
                    {/* Sale Badge - Top Left */}
                    {product.discountPrice && product.discountPrice > 0 && (
                      <div className="absolute top-3 left-3 z-10">
                        <span className="px-3 py-1 bg-red-500 text-white text-xs font-bold rounded-full shadow-lg animate-pulse">
                          SALE
                        </span>
                      </div>
                    )}

                    {/* Stock Status Badge */}
                    <div className="absolute top-3 right-3 z-10">
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
                      src={product.imageUrl || '/images/products/default.svg'}
                      alt={product.name}
                      className="max-w-full max-h-full object-contain rounded group-hover:opacity-80 transition-opacity pointer-events-none"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/images/products/default.svg'
                      }}
                      loading="lazy"
                    />
                  </div>

                    {/* Card Content */}
                    <div className="p-4 flex flex-col flex-grow">
                    {/* Product Name */}
                    <h3 className="text-white font-semibold text-lg mb-1 line-clamp-1">
                      {product.name}
                    </h3>

                    {/* Product Category */}
                    <p className="text-slate-300 text-sm mb-3 line-clamp-1">
                      {product.description || product.category || 'Product'}
                    </p>

                      {/* Material Design Divider */}
                      <div className="border-t border-slate-600 mb-4"></div>

                    {/* Price & Stock Info */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex flex-col">
                        {product.discountPrice && product.discountPrice > 0 ? (
                          <>
                            {/* Original price with label and strikethrough */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-slate-500 font-medium">Original:</span>
                              <div className="text-lg text-slate-400 line-through">
                                ₱{product.price.toFixed(2)}
                              </div>
                            </div>
                            {/* Sale price with label - larger and highlighted */}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-red-300 font-medium">Sale Price:</span>
                              <div className="text-2xl font-bold text-red-400">
                                ₱{product.discountPrice.toFixed(2)}
                              </div>
                            </div>
                            {/* Savings indicator */}
                            <div className="text-xs text-green-400 font-medium mt-1">
                              Save ₱{(product.price - product.discountPrice).toFixed(2)} 
                              ({(((product.price - product.discountPrice) / product.price) * 100).toFixed(0)}% off)
                            </div>
                          </>
                        ) : (
                          /* Regular price when no discount */
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 font-medium">Price:</span>
                            <div className="text-2xl font-bold text-blue-400">
                              ₱{product.price.toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                      {activeTab === 'shop' ? (
                          <div>
                            <div className={`text-sm font-bold ${
                              getActualAvailableQuantity(product) === 0 
                                ? 'text-red-400' 
                                : getActualAvailableQuantity(product) <= 5 
                                ? 'text-orange-400' 
                                : 'text-green-400'
                            }`}>
                              {getActualAvailableQuantity(product) === 0 ? 'SOLD OUT' : `${getActualAvailableQuantity(product)} LEFT`}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                              {getActualAvailableQuantity(product) === 0 ? 'Not available' : 'Available now'}
                            </div>
                          </div>
                        ) : (
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
                        )}
                      </div>
                    </div>
                  
                    {/* Quantity Selector */}
                    <div className="flex items-center justify-center mb-2 mt-auto">
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
                    
                    {/* Add to Cart Button */}
                    <div className="mt-auto">
                      <button
                          onClick={() => !isOutOfStock && addToCart(product, selectedQuantities[product._id] || 1)}
                          disabled={isOutOfStock || addingToCart === product._id}
                          className={`w-full py-3 px-4 rounded font-medium transition-all duration-200 flex items-center justify-center gap-2 uppercase text-sm tracking-wide ${
                            isOutOfStock
                              ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                              : activeTab === 'preorder' 
                              ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-[0_2px_4px_-1px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.4)] hover:scale-[1.02]'
                            : addingToCart === product._id
                              ? 'bg-blue-600 text-white cursor-wait shadow-[0_2px_4px_-1px_rgba(0,0,0,0.3)]'
                              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-[0_2px_4px_-1px_rgba(0,0,0,0.3)] hover:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.4)] hover:scale-[1.02]'
                          }`}
                      >
                      {isOutOfStock ? (
                        <>
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                          </svg>
                          Out of Stock
                        </>
                      ) : addingToCart === product._id ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                          {activeTab === 'preorder' ? 'Adding...' : 'Adding...'}
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-1.1 5M7 13l-1.1 5m0 0h9.1M17 21a2 2 0 100-4 2 2 0 000 4zM9 21a2 2 0 100-4 2 2 0 000 4z" />
                          </svg>
                          {activeTab === 'preorder' 
                            ? 'Reserve Now' 
                            : `Add ${selectedQuantities[product._id] || 1} to Cart`
                          }
                        </>
                      )}
                      </button>
                    </div>
                    </div> {/* End Card Content */}
                  </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Reserved Items */}
          <div className="xl:col-span-2 order-1 xl:order-2">
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 p-4 sm:p-6 lg:sticky lg:top-8 xl:mt-32">
              {/* Reserved Items Header with Tabs */}
              <div className="border-b border-gray-200 dark:border-slate-700 mb-4 pb-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex items-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H20a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    Reservations
                  </h3>
                </div>
                
                {/* Tabs */}
                <div className="flex space-x-1">
                  <button
                    onClick={() => setActiveCartTab('cart')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeCartTab === 'cart'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {activeTab === 'preorder' ? 'Preorder' : 'Cart'} (
                    <span 
                      className={`${
                        activeTab === 'preorder' && shouldPulsePreorder && preorderCart.length > 0
                          ? 'animate-pulse-notification text-orange-500 dark:text-orange-400 font-bold' 
                          : ''
                      }`}
                    >
                      {activeTab === 'preorder' ? preorderCart.length : cart.length}
                    </span>
                    )
                  </button>
                  <button
                    onClick={() => setActiveCartTab('confirmed')}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      activeCartTab === 'confirmed'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    Confirmed ({confirmedReservations.length})
                  </button>
                </div>
              </div>
              {activeCartTab === 'cart' ? (
                (activeTab === 'preorder' ? preorderCart.length : cart.length) === 0 ? (
                  <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H20a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                    </svg>
                    No items in cart yet
                    <br />
                    <span className="text-xs">Start browsing to add your favorites!</span>
                </p>
              ) : (
                <>
                  <div className="space-y-3 mb-4 max-h-64 sm:max-h-96 overflow-y-auto">
                    {(activeTab === 'preorder' ? preorderCart : cart).map((item) => (
                      <div
                        key={item.product._id}
                        className="flex items-center p-3 bg-gray-50 dark:bg-slate-700 rounded-lg space-x-3"
                      >
                        {/* Product Image */}
                        <div className="flex-shrink-0 relative group cursor-pointer" onClick={() => setSelectedImageProduct(item.product)}>
                          <img
                            src={item.product.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjNjM2MzYzIi8+CjxwYXRoIGQ9Ik0xMiAxNkwyMCAyNEwyOCAxNlYyOEgxMlYxNloiIGZpbGw9IiM5OTk5OTkiLz4KPGNpcmNsZSBjeD0iMTYiIGN5PSIyMCIgcj0iMiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K'}
                            alt={item.product.name}
                            className="w-12 h-12 rounded-lg object-cover bg-gray-200 dark:bg-slate-600 group-hover:opacity-80 transition-opacity"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                          {/* Small Enlarge Icon for Cart Items */}
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center rounded-lg">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-1 shadow-lg transform scale-75 group-hover:scale-100 transition-transform duration-300">
                              <svg className="w-3 h-3 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-slate-100 truncate">
                            {item.product.name}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-slate-400">
                            ₱{getEffectivePrice(item.product).toFixed(2)} × {item.quantity}
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
                      disabled={submitting || (activeTab === 'preorder' ? preorderCart.length : cart.length) === 0}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-3 px-4 rounded-lg disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                    >
                      {submitting ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                          Reserving Items...
                        </div>
                      ) : (
                        <div className="flex items-center justify-center">
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h1.586a1 1 0 01.707.293l1.414 1.414a1 1 0 00.707.293H20a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                          </svg>
                          Reserve Orders
                        </div>
                      )}
                    </button>

                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-2 text-center">
                      Reservations require admin approval
                    </p>
                  </div>
                </>
                )
              ) : (
                // Confirmed Reservations Tab
                confirmedReservations.length === 0 ? (
                  <p className="text-gray-500 dark:text-slate-400 text-center py-8">
                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-400 dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    No confirmed reservations yet
                    <br />
                    <span className="text-xs">Add items to cart and click "Reserve Orders" to confirm!</span>
                  </p>
                ) : (
                  <div className="space-y-3 max-h-64 sm:max-h-96 overflow-y-auto">
                    {confirmedReservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              Order #{reservation.id.slice(-6)}
                            </span>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusDisplay(reservation.approvalStatus, reservation.paymentStatus).bgColor} ${getStatusDisplay(reservation.approvalStatus, reservation.paymentStatus).textColor}`}>
                            {getStatusDisplay(reservation.approvalStatus, reservation.paymentStatus).text}
                          </span>
                        </div>
                        
                        <div className="space-y-2 mb-3">
                          {reservation.items.map((item: any, index: number) => (
                            <div key={index} className="flex items-center space-x-3 text-sm">
                              {/* Product Image */}
                              <div className="flex-shrink-0">
                                <img
                                  src={item.productImage || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjNjM2MzYzIi8+CjxwYXRoIGQ9Ik0xMiAxNkwyMCAyNEwyOCAxNlYyOEgxMlYxNloiIGZpbGw9IiM5OTk5OTkiLz4KPGNpcmNsZSBjeD0iMTYiIGN5PSIyMCIgcj0iMiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K'}
                                  alt={item.productName}
                                  className="w-8 h-8 rounded-md object-cover bg-gray-200 dark:bg-slate-600"
                                  onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none'
                                  }}
                                />
                              </div>
                              
                              <div className="flex-1">
                              <span className="text-gray-700 dark:text-slate-300">
                                {item.productName} × {item.quantity}
                              </span>
                              </div>
                              
                              <span className="text-gray-900 dark:text-slate-100 font-medium">
                                ₱{item.totalPrice.toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Payment Information */}
                        {reservation.paymentStatus === 'partial' && (
                          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                            <div className="text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">Payment Details:</div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-blue-700 dark:text-blue-300">Amount Paid:</span>
                                <span className="font-medium text-blue-900 dark:text-blue-100">₱{reservation.amountPaid.toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-blue-700 dark:text-blue-300">Amount Due:</span>
                                <span className="font-medium text-blue-900 dark:text-blue-100">₱{reservation.amountDue.toFixed(2)}</span>
                              </div>
                              {reservation.payments && reservation.payments.length > 0 && (
                                <div className="mt-2 pt-1 border-t border-blue-300 dark:border-blue-700">
                                  <div className="text-blue-800 dark:text-blue-300 font-medium mb-1">Recent Payments:</div>
                                  {reservation.payments.slice(0, 3).map((payment: any, index: number) => (
                                    <div key={index} className="flex justify-between text-xs">
                                      <span className="text-blue-600 dark:text-blue-400">
                                        {new Date(payment.date).toLocaleDateString()} ({payment.method})
                                      </span>
                                      <span className="font-medium text-blue-900 dark:text-blue-100">₱{payment.amount.toFixed(2)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-600">
                          <span className="text-xs text-gray-500 dark:text-slate-400">
                            {new Date(reservation.createdAt).toLocaleDateString()}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            Total: ₱{reservation.totalAmount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
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
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-slate-100">Order Summary</h4>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      activeTab === 'preorder' 
                        ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' 
                        : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                    }`}>
                      {activeTab === 'preorder' ? 'Preorder' : 'Regular Order'}
                        </span>
                  </div>
                  <div className="space-y-2">
                    {(activeTab === 'preorder' ? preorderCart : cart).map((item) => (
                      <div key={item.product._id} className="flex items-center space-x-3 text-sm">
                        {/* Product Image */}
                        <div className="flex-shrink-0">
                          <img
                            src={item.product.imageUrl || 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBmaWxsPSIjNjM2MzYzIi8+CjxwYXRoIGQ9Ik0xMiAxNkwyMCAyNEwyOCAxNlYyOEgxMlYxNloiIGZpbGw9IiM5OTk5OTkiLz4KPGNpcmNsZSBjeD0iMTYiIGN5PSIyMCIgcj0iMiIgZmlsbD0iIzk5OTk5OSIvPgo8L3N2Zz4K'}
                            alt={item.product.name}
                            className="w-10 h-10 rounded-md object-cover bg-gray-200 dark:bg-slate-600"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        </div>
                        
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-slate-100">
                            {item.product.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-slate-400">
                            ₱{getEffectivePrice(item.product).toFixed(2)} × {item.quantity}
                          </div>
                        </div>
                        
                        <span className="text-gray-900 dark:text-slate-100 font-medium">
                          ₱{(getEffectivePrice(item.product) * item.quantity).toFixed(2)}
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
                    ? 'Your order changes will be saved and you can track the updated order status.'
                    : 'Your order will be confirmed and you can track its status and payment details in the Confirmed tab.'
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

      {/* Image Modal */}
      {selectedImageProduct && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedImageProduct(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[85vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-600">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-slate-100 truncate pr-4">
                {selectedImageProduct.name}
              </h3>
              <button
                onClick={() => setSelectedImageProduct(null)}
                className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal Content - Landscape Layout */}
            <div className="flex flex-col lg:flex-row h-full max-h-[calc(85vh-80px)]">
              {/* Image Section - Left Side */}
              <div className="flex-1 lg:flex-[2] p-4 sm:p-6 flex items-center justify-center bg-gray-50 dark:bg-slate-900 relative">
                {/* Sale Badge for Modal */}
                {selectedImageProduct.discountPrice && selectedImageProduct.discountPrice > 0 && (
                  <div className="absolute top-6 left-6 z-10">
                    <span className="px-4 py-2 bg-red-500 text-white text-sm font-bold rounded-full shadow-lg animate-pulse">
                      SALE
                    </span>
                  </div>
                )}
                <img
                  src={selectedImageProduct.imageUrl || '/images/products/default.svg'}
                  alt={selectedImageProduct.name}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                  style={{ maxHeight: '500px' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/products/default.svg'
                  }}
                />
              </div>
              
              {/* Details Section - Right Side */}
              <div className="flex-1 p-4 sm:p-6 overflow-y-auto bg-white dark:bg-slate-800">
                <div className="space-y-6">
                  {/* Price Badge */}
                  <div className="flex items-center gap-3">
                    {selectedImageProduct.discountPrice && selectedImageProduct.discountPrice > 0 ? (
                      <div className="flex flex-col items-start">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Original Price:</span>
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 line-through">
                            ₱{selectedImageProduct.price.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">Sale Price:</span>
                          <span className="inline-flex items-center px-4 py-2 rounded-full text-lg font-bold bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                            ₱{selectedImageProduct.discountPrice.toFixed(2)}
                          </span>
                        </div>
                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                          Save ₱{(selectedImageProduct.price - selectedImageProduct.discountPrice).toFixed(2)} 
                          ({(((selectedImageProduct.price - selectedImageProduct.discountPrice) / selectedImageProduct.price) * 100).toFixed(0)}% off)
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Price:</span>
                        <span className="inline-flex items-center px-4 py-2 rounded-full text-lg font-bold bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          ₱{selectedImageProduct.price.toFixed(2)}
                        </span>
                      </div>
                    )}
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
                        <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Product Information
                      </h4>
                      <div className="bg-gray-50 dark:bg-slate-700 rounded-lg p-4 space-y-2">
                        <p className="text-gray-700 dark:text-slate-300">
                          <span className="font-semibold text-gray-900 dark:text-slate-100">Name:</span> {selectedImageProduct.name}
                        </p>
                        <p className="text-gray-700 dark:text-slate-300">
                          <span className="font-semibold text-gray-900 dark:text-slate-100">Availability:</span> {getActualAvailableQuantity(selectedImageProduct)} units available
                        </p>
                      </div>
                    </div>
                    
                    {selectedImageProduct.description && (
                      <div>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-3 flex items-center">
                          <svg className="w-5 h-5 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
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

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={showQRCodeModal}
        onClose={() => setShowQRCodeModal(false)}
        qrCodes={store?.qrCodes || {}}
        storeName={store?.name || storeName}
      />

      {/* Feedback Form Modal */}
      {showFeedbackForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white text-center">
                  Share Your Feedback
                </h3>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Name
                  </label>
                  <input
                    type="text"
                    value={feedbackForm.customerName}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, customerName: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="Enter your name"
                    required
                  />
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Your Rating:
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowFeedbackForm(false)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFeedbackForm(true)}
                      className="ml-auto bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-medium transition-colors"
                    >
                      <svg className="w-3 h-3 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      Feedback
                    </button>
                  </div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setFeedbackForm(prev => ({ ...prev, rating }))}
                        className="text-2xl transition-colors"
                      >
                        <svg
                          className={`w-8 h-8 ${rating <= feedbackForm.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Comment
                  </label>
                  <textarea
                    value={feedbackForm.comment}
                    onChange={(e) => setFeedbackForm(prev => ({ ...prev, comment: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                    placeholder="Share your experience with this store..."
                    rows={4}
                    required
                  />
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowFeedbackForm(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium"
                  >
                    Submit Feedback
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      <LoadingOverlay
        isVisible={loading}
        title="Loading Store"
        message="Fetching products and store information..."
        color="purple"
      />
    </div>
  )
}
