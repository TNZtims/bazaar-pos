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

interface Product {
  _id: string
  name: string
  cost?: number
  price: number
  quantity: number           // Legacy field
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
      className="text-sm text-gray-500 dark:text-slate-400 relative inline-block"
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
          className="fixed z-[9999] bg-white dark:bg-slate-800 border border-gray-300 dark:border-slate-600 rounded-lg p-3 shadow-xl max-w-sm whitespace-normal text-gray-900 dark:text-slate-100 pointer-events-none min-w-[200px]"
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
  
  // Real-time inventory updates via WebSocket
  const { 
    updates: inventoryUpdates, 
    deletedProducts,
    isConnected: isWebSocketConnected,
    error: webSocketError
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
    quantity: '',  // We'll still use this field name for backward compatibility 
    description: '',
    category: '',
    sku: '',
    seller: '',
    imageUrl: ''
  })

  useEffect(() => {
    fetchProducts()
  }, [searchTerm])

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
      const productData = {
        ...formData,
        cost: formData.cost && formData.cost.trim() !== '' ? parseFloat(formData.cost) : null,
        price: parseFloat(formData.price),
        totalQuantity: parseInt(formData.quantity)  // Send as totalQuantity to the API
      }
      

      const url = editingProduct ? `/api/products/${editingProduct._id}` : '/api/products'
      const method = editingProduct ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData)
      })

      if (response.ok) {
        await response.json()
        
        setShowModal(false)
        setEditingProduct(null)
        setFormData({ name: '', cost: '', price: '', quantity: '', description: '', category: '', sku: generateSKU(), seller: '', imageUrl: '' })
        
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
    setEditingProduct(product)
    setFormData({
      name: product.name,
      cost: product.cost ? product.cost.toString() : '',
      price: product.price.toString(),
      quantity: (product.totalQuantity || product.quantity).toString(),  // Use totalQuantity if available, fallback to legacy quantity
      description: product.description || '',
      category: product.category || '',
      sku: product.sku || '',
      seller: product.seller || '',
      imageUrl: product.imageUrl || ''
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
            
            closeConfirmation()
            fetchProducts()
            success('Product deleted successfully!', 'Deleted')
          } else {
            error('Error deleting product', 'Delete Failed')
          }
        } catch (err) {
          console.error('Error deleting product:', err)
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
    setFormData({ name: '', cost: '', price: '', quantity: '', description: '', category: '', sku: generateSKU(), seller: '', imageUrl: '' })
    setShowModal(true)
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 px-4 sm:px-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Products</h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Manage your inventory</p>
          </div>
          <button
            onClick={openAddModal}
            className="mt-4 sm:mt-0 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Add Product
          </button>
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
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-600 dark:text-slate-400">Loading...</div>
          ) : products.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-slate-400">
              No products found. {searchTerm ? 'Try a different search term.' : 'Add your first product!'}
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                <thead className="bg-gray-50 dark:bg-slate-700">
                  <tr>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Image
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Product
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Cost
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Price
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Profit
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Stock
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Seller
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                  {products.map((product) => (
                    <tr key={product._id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
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
                          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">{product.name}</div>
                          {product.description && (
                            <TruncatedDescription description={product.description} />
                          )}
                          {product.sku && (
                            <div className="text-xs text-gray-400 dark:text-slate-500">SKU: {product.sku}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                        ₱{(product.cost || 0).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                        ₱{product.price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {product.cost ? (
                          <span className={`${(product.price - product.cost) > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            ₱{(product.price - product.cost).toFixed(2)} ({(((product.price - product.cost) / product.cost) * 100).toFixed(1)}%)
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-slate-400 text-sm">
                            No cost data
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            (product.availableQuantity || product.quantity) < 10 
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400' 
                              : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400'
                          }`}>
                            {product.availableQuantity !== undefined ? product.availableQuantity : product.quantity} Available
                          </div>
                          {product.totalQuantity !== undefined && (
                            <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                              Total: {product.totalQuantity}, Reserved: {product.reservedQuantity || 0}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                        {product.category || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                        {product.seller || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          disabled={deleting === product._id}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deleting === product._id ? 'Deleting...' : 'Delete'}
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
                  <div key={product._id} className="border border-gray-200 dark:border-slate-600 rounded-lg p-4 bg-white dark:bg-slate-700">
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
                        <h3 className="font-medium text-gray-900 dark:text-slate-100 truncate">{product.name}</h3>
                        {product.description && (
                          <p className="text-sm text-gray-600 dark:text-slate-400 mt-1 line-clamp-2">{product.description}</p>
                        )}
                        {product.sku && (
                          <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">SKU: {product.sku}</p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                      <div>
                        <span className="text-gray-500 dark:text-slate-400">Cost:</span>
                        <span className="ml-1 font-medium text-gray-900 dark:text-slate-100">₱{product.cost?.toFixed(2) || '0.00'}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-slate-400">Price:</span>
                        <span className="ml-1 font-medium text-gray-900 dark:text-slate-100">₱{product.price.toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-slate-400">Profit:</span>
                        <span className="ml-1 font-medium text-green-600 dark:text-green-400">₱{((product.price - (product.cost || 0))).toFixed(2)}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-slate-400">Stock:</span>
                        <div className="ml-1">
                          <span className={`font-medium ${
                            (product.availableQuantity || product.quantity) > 10 ? 'text-green-600 dark:text-green-400' :
                            (product.availableQuantity || product.quantity) > 0 ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-red-600 dark:text-red-400'
                          }`}>
                            {product.availableQuantity !== undefined ? product.availableQuantity : product.quantity} Available
                          </span>
                          {product.totalQuantity !== undefined && (
                            <div className="text-xs text-gray-500 dark:text-slate-400">
                              Total: {product.totalQuantity} | Reserved: {product.reservedQuantity || 0}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-slate-400">Seller:</span>
                        <span className="ml-1 font-medium text-gray-900 dark:text-slate-100">{product.seller || '-'}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400">
                        {product.category}
                      </span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium touch-manipulation px-3 py-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(product._id)}
                          disabled={deleting === product._id}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium touch-manipulation px-3 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {deleting === product._id ? 'Deleting...' : 'Delete'}
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
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
              {editingProduct ? 'Edit Product' : 'Add Product'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Cost (₱) <span className="text-sm text-gray-500">(for profit tracking)</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.cost}
                    onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="0.00"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Price (₱) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                    Seller
                  </label>
                  <input
                    type="text"
                    value={formData.seller}
                    onChange={(e) => setFormData({ ...formData, seller: e.target.value })}
                    placeholder="Seller/supplier name"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  SKU
                </label>
                <div className="flex space-x-2">
                    <input
                      type="text"
                      value={formData.sku}
                      onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sku: generateSKU() })}
                      className="px-3 py-2 bg-gray-100 dark:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-md hover:bg-gray-200 dark:hover:bg-slate-500 transition-colors text-sm"
                      title="Generate new SKU"
                    >
                      🔄
                    </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Auto-generated SKU. Click 🔄 to generate a new one.
                </p>
              </div>

              {/* Product Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">
                  Product Image <span className="text-sm text-gray-500">(optional)</span>
                </label>
                <ImageUpload
                  currentImage={formData.imageUrl}
                  onImageChange={(imageUrl) => setFormData({ ...formData, imageUrl })}
                  onImageRemove={() => setFormData({ ...formData, imageUrl: '' })}
                />
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                  Upload an image or take a photo. Leave empty to use default category-based image.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {submitting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      {editingProduct ? 'Updating...' : 'Adding...'}
                    </div>
                  ) : (
                    `${editingProduct ? 'Update' : 'Add'} Product`
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
          />
        {/* </div> */}
      </Layout>
    </ProtectedRoute>
  )
}
