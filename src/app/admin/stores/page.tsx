'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useRouter } from 'next/navigation'

interface Store {
  _id: string
  storeName: string
  isActive: boolean
  isAdmin: boolean
  cashiers: string[]
  isOnline: boolean
  isLocked: boolean
  bannerImageUrl?: string
  logoImageUrl?: string
  storeHours: {
    monday: { open: string, close: string, closed: boolean }
    tuesday: { open: string, close: string, closed: boolean }
    wednesday: { open: string, close: string, closed: boolean }
    thursday: { open: string, close: string, closed: boolean }
    friday: { open: string, close: string, closed: boolean }
    saturday: { open: string, close: string, closed: boolean }
    sunday: { open: string, close: string, closed: boolean }
  }
  createdAt: string
  updatedAt: string
}

export default function AdminStoresPage() {
  const { isAdmin, isAuthenticated } = useAuth()
  const { success, error } = useToast()
  const router = useRouter()
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingStore, setEditingStore] = useState<Store | null>(null)
  const [formData, setFormData] = useState({
    storeName: '',
    password: '',
    confirmPassword: '',
    isAdmin: false,
    cashiers: '',
    bannerImageUrl: '',
    logoImageUrl: ''
  })
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [togglingStore, setTogglingStore] = useState<string | null>(null)
  const [uploadingBanner, setUploadingBanner] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  // Redirect if not admin
  useEffect(() => {
    if (isAuthenticated && !isAdmin) {
      router.push('/')
    }
  }, [isAuthenticated, isAdmin, router])

  useEffect(() => {
    if (isAdmin) {
      fetchStores()
    }
  }, [isAdmin])

  const fetchStores = async () => {
    try {
      const response = await fetch('/api/admin/stores')
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched stores data:', data.stores) // Debug log
        setStores(data.stores || [])
      } else {
        error('Failed to fetch stores')
      }
    } catch (err) {
      error('Error fetching stores')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateStore = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.storeName || !formData.password) {
      error('Store name and password are required')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      error('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      error('Password must be at least 6 characters')
      return
    }

    setIsCreating(true)

    try {
      const response = await fetch('/api/stores/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          storeName: formData.storeName,
          password: formData.password,
          isAdmin: formData.isAdmin,
          cashiers: formData.cashiers.split(',').map(c => c.trim()).filter(c => c)
        }),
        credentials: 'include'
      })

      const data = await response.json()

      if (response.ok) {
        success('Store created successfully!')
        setShowCreateModal(false)
        resetForm()
        fetchStores()
      } else {
        error(data.message || 'Failed to create store')
      }
    } catch (err) {
      error('Error creating store')
    } finally {
      setIsCreating(false)
    }
  }

  const handleEditStore = (store: Store) => {
    console.log('Opening edit modal for store:', store) // Debug log
    console.log('Store banner URL:', store.bannerImageUrl) // Debug log
    console.log('Store logo URL:', store.logoImageUrl) // Debug log
    
    setEditingStore(store)
    const formDataToSet = {
      storeName: store.storeName,
      password: '',
      confirmPassword: '',
      isAdmin: store.isAdmin,
      cashiers: store.cashiers.join(', '),
      bannerImageUrl: store.bannerImageUrl || '',
      logoImageUrl: store.logoImageUrl || ''
    }
    console.log('Setting form data:', formDataToSet) // Debug log
    setFormData(formDataToSet)
    setShowEditModal(true)
  }

  const handleUpdateStore = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.storeName) {
      error('Store name is required')
      return
    }

    // Only validate password if it's being changed
    if (formData.password) {
      if (formData.password !== formData.confirmPassword) {
        error('Passwords do not match')
        return
      }

      if (formData.password.length < 6) {
        error('Password must be at least 6 characters')
        return
      }
    }

    if (!editingStore) return

    setIsUpdating(true)

    try {
      const updateData: any = {
        storeName: formData.storeName,
        isAdmin: formData.isAdmin,
        cashiers: formData.cashiers.split(',').map(c => c.trim()).filter(c => c),
        bannerImageUrl: formData.bannerImageUrl,
        logoImageUrl: formData.logoImageUrl
      }
      
      console.log('Sending update data:', updateData) // Debug log

      // Only include password if it's being changed
      if (formData.password) {
        updateData.password = formData.password
      }

      const response = await fetch(`/api/admin/stores/${editingStore._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updateData),
        credentials: 'include'
      })

      const data = await response.json()
      console.log('Update response:', data) // Debug log

      if (response.ok) {
        console.log('Store updated successfully, updated store data:', data.store) // Debug log
        success('Store updated successfully!')
        setShowEditModal(false)
        setEditingStore(null)
        resetForm()
        // Refresh stores list to get updated image URLs
        await fetchStores()
      } else {
        console.error('Update failed:', data) // Debug log
        error(data.message || 'Failed to update store')
      }
    } catch (err) {
      error('Error updating store')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleImageUpload = async (file: File, type: 'banner' | 'logo') => {
    const setUploading = type === 'banner' ? setUploadingBanner : setUploadingLogo
    setUploading(true)
    
    try {
      // Get presigned URL
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        })
      })

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        throw new Error(errorData.error || 'Failed to get upload URL')
      }

      const { uploadUrl, fileUrl } = await uploadResponse.json()

      // Upload file to S3
      const s3Response = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      })

      if (!s3Response.ok) {
        throw new Error('Failed to upload file')
      }

      // Update form data with the file URL
      const fieldName = type === 'banner' ? 'bannerImageUrl' : 'logoImageUrl'
      console.log(`Setting ${fieldName} to:`, fileUrl) // Debug log
      
      setFormData(prev => {
        const newFormData = {
          ...prev,
          [fieldName]: fileUrl
        }
        console.log('Updated form data:', newFormData) // Debug log
        return newFormData
      })

      success(`${type === 'banner' ? 'Banner' : 'Logo'} uploaded successfully!`)
      
      // Small delay to ensure state is fully updated
      setTimeout(() => {
        console.log('Form data after upload delay:', formData) // Debug log
      }, 100)
      
    } catch (err: any) {
      error(`Failed to upload ${type}: ${err.message}`)
    } finally {
      setUploading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      storeName: '',
      password: '',
      confirmPassword: '',
      isAdmin: false,
      cashiers: '',
      bannerImageUrl: '',
      logoImageUrl: ''
    })
  }

  const toggleStoreStatus = async (storeId: string, currentStatus: boolean) => {
    try {
      const response = await fetch(`/api/admin/stores/${storeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isActive: !currentStatus
        }),
        credentials: 'include'
      })

      if (response.ok) {
        success(`Store ${!currentStatus ? 'activated' : 'deactivated'} successfully!`)
        fetchStores()
      } else {
        error('Failed to update store status')
      }
    } catch (err) {
      error('Error updating store status')
    }
  }

  const toggleStoreLock = async (storeId: string, currentLockStatus: boolean) => {
    // Prevent multiple clicks
    if (togglingStore === storeId) return
    
    try {
      setTogglingStore(storeId)
      
      const response = await fetch(`/api/admin/stores/${storeId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isLocked: !currentLockStatus
        }),
        credentials: 'include'
      })

      const responseData = await response.json()

      if (response.ok) {
        success(`Store ${!currentLockStatus ? 'locked (closed to public)' : 'unlocked (opened to public)'} successfully!`)
        // Wait for store list to refresh before clearing loading state
        await fetchStores()
        // Add a small delay to ensure UI has updated
        await new Promise(resolve => setTimeout(resolve, 100))
      } else {
        error(responseData.message || 'Failed to update store lock status')
      }
    } catch (err) {
      console.error('Error updating store lock status:', err)
      error('Error updating store lock status')
    } finally {
      setTogglingStore(null)
    }
  }

  // Don't render anything if not admin
  if (!isAuthenticated || !isAdmin) {
    return null
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 px-4 sm:px-0">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Store Management</h1>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">Create and manage stores in the system</p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-4 sm:mt-0 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              Create New Store
            </button>
          </div>

          {/* Stores List */}
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700">
            {loading ? (
              <div className="p-8 text-center text-gray-600 dark:text-slate-400">Loading stores...</div>
            ) : stores.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-slate-400">
                No stores found. Create your first store!
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-slate-700">
                  <thead className="bg-gray-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Store Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Public Access
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Cashiers
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-gray-200 dark:divide-slate-700">
                    {stores.map((store) => (
                      <tr key={store._id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-slate-100">
                            {store.storeName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            store.isAdmin 
                              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                              : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                          }`}>
                            {store.isAdmin ? 'Admin' : 'Regular'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            store.isActive
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                          }`}>
                            {store.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => toggleStoreLock(store._id, store.isLocked || false)}
                            disabled={togglingStore === store._id}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed ${
                              togglingStore === store._id
                                ? 'bg-gray-400'
                                : store.isLocked
                                ? 'bg-red-400'
                                : 'bg-green-400'
                            }`}
                            title={
                              togglingStore === store._id
                                ? 'Processing...'
                                : store.isLocked 
                                ? 'Store is closed to public - Click to open' 
                                : 'Store is open to public - Click to close'
                            }
                          >
                            {togglingStore === store._id ? (
                              // Loading spinner
                              <div className="inline-flex h-4 w-4 items-center justify-center ml-3.5">
                                <div className="animate-spin rounded-full h-3 w-3 border border-white border-t-transparent"></div>
                              </div>
                            ) : (
                              // Normal toggle circle
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  store.isLocked ? 'translate-x-1' : 'translate-x-6'
                                }`}
                              />
                            )}
                          </button>
                          <span className={`ml-2 text-xs font-medium ${
                            togglingStore === store._id
                              ? 'text-gray-500 dark:text-gray-400'
                              : store.isLocked
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-green-500 dark:text-green-400'
                          }`}>
                            {togglingStore === store._id 
                              ? 'Processing...' 
                              : store.isLocked 
                              ? 'Closed' 
                              : 'Open'
                            }
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-slate-100">
                          {store.cashiers.length > 0 ? store.cashiers.join(', ') : 'None'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-slate-400">
                          {new Date(store.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                          <button
                            onClick={() => handleEditStore(store)}
                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleStoreStatus(store._id, store.isActive)}
                            className={`text-sm font-medium ${
                              store.isActive
                                ? 'text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300'
                                : 'text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300'
                            }`}
                          >
                            {store.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Create Store Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-800 rounded-xl max-w-md w-full p-6 border border-gray-200 dark:border-slate-700 shadow-2xl">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  Create New Store
                </h2>
                
                <form onSubmit={handleCreateStore} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Store Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.storeName}
                      onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter store name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Password"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Confirm Password *
                      </label>
                      <input
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Confirm password"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Cashiers (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.cashiers}
                      onChange={(e) => setFormData({ ...formData, cashiers: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe, Jane Smith"
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isAdmin"
                      checked={formData.isAdmin}
                      onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="isAdmin" className="ml-2 block text-sm text-gray-700 dark:text-slate-300">
                      Create as Admin Store
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isCreating ? 'Creating...' : 'Create Store'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Store Modal */}
          {showEditModal && editingStore && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white dark:bg-slate-800 rounded-xl max-w-2xl w-full p-6 border border-gray-200 dark:border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-4">
                  Edit Store: {editingStore.storeName}
                </h2>
                
                <form onSubmit={handleUpdateStore} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Store Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.storeName}
                      onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter store name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        New Password (optional)
                      </label>
                      <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Leave empty to keep current"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={formData.confirmPassword}
                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Confirm new password"
                        disabled={!formData.password}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Cashiers (comma-separated)
                    </label>
                    <input
                      type="text"
                      value={formData.cashiers}
                      onChange={(e) => setFormData({ ...formData, cashiers: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="John Doe, Jane Smith"
                    />
                  </div>

                  {/* Banner Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Store Banner Image
                    </label>
                    <div className="space-y-2">
                      {formData.bannerImageUrl && formData.bannerImageUrl !== '' && (
                        <div className="relative">
                          <img 
                            src={formData.bannerImageUrl} 
                            alt="Banner preview" 
                            className="w-full h-24 object-cover rounded-md border border-gray-300 dark:border-slate-600"
                            onError={(e) => {
                              console.log('Banner image failed to load:', formData.bannerImageUrl)
                              // Don't hide the container, just show a placeholder
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDIwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik04NS4zMzMzIDQySDExNC42NjdWNThIODUuMzMzM1Y0MloiIGZpbGw9IiM5Q0EzQUYiLz4KPHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEwIDEyQzExLjEwNDYgMTIgMTIgMTEuMTA0NiAxMiAxMEMxMiA4Ljg5NTQzIDExLjEwNDYgOCAxMCA4QzguODk1NDMgOCA4IDguODk1NDMgOCAxMEM4IDExLjEwNDYgOC44OTU0MyAxMiAxMCAxMloiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+Cjwvc3ZnPgo='
                            }}
                            onLoad={() => console.log('Banner image loaded successfully:', formData.bannerImageUrl)}
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, bannerImageUrl: '' })}
                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-2 py-1 rounded">
                            Banner Image
                          </div>
                        </div>
                      )}
                      {(!formData.bannerImageUrl || formData.bannerImageUrl === '') && (
                        <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-md p-4 text-center">
                          <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <p className="text-sm text-gray-500 dark:text-slate-400">No banner image uploaded</p>
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(file, 'banner')
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        disabled={uploadingBanner}
                      />
                      {uploadingBanner && (
                        <p className="text-sm text-blue-600 dark:text-blue-400">Uploading banner...</p>
                      )}
                    </div>
                  </div>

                  {/* Logo Image Upload */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                      Store Logo Image
                    </label>
                    <div className="space-y-2">
                      {formData.logoImageUrl && formData.logoImageUrl !== '' && (
                        <div className="relative inline-block">
                          <img 
                            src={formData.logoImageUrl} 
                            alt="Logo preview" 
                            className="w-20 h-20 object-cover rounded-full border border-gray-300 dark:border-slate-600"
                            onError={(e) => {
                              console.log('Logo image failed to load:', formData.logoImageUrl)
                              // Show a placeholder circle
                              e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA4MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iNDAiIGN5PSI0MCIgcj0iNDAiIGZpbGw9IiNGM0Y0RjYiLz4KPHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDE0QzEzLjEwNDYgMTQgMTQgMTMuMTA0NiAxNCAxMkMxNCAxMC44OTU0IDEzLjEwNDYgMTAgMTIgMTBDMTAuODk1NCAxMCAxMCAxMC44OTU0IDEwIDEyQzEwIDEzLjEwNDYgMTAuODk1NCAxNCAxMiAxNFoiIGZpbGw9IiM5Q0EzQUYiLz4KPC9zdmc+Cjwvc3ZnPgo='
                            }}
                            onLoad={() => console.log('Logo image loaded successfully:', formData.logoImageUrl)}
                          />
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, logoImageUrl: '' })}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                          <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-black/50 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                            Logo Image
                          </div>
                        </div>
                      )}
                      {(!formData.logoImageUrl || formData.logoImageUrl === '') && (
                        <div className="border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-2">
                          <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      )}
                      {(!formData.logoImageUrl || formData.logoImageUrl === '') && (
                        <p className="text-sm text-gray-500 dark:text-slate-400 text-center mb-2">No logo image uploaded</p>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) handleImageUpload(file, 'logo')
                        }}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                        disabled={uploadingLogo}
                      />
                      {uploadingLogo && (
                        <p className="text-sm text-blue-600 dark:text-blue-400">Uploading logo...</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="editIsAdmin"
                      checked={formData.isAdmin}
                      onChange={(e) => setFormData({ ...formData, isAdmin: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label htmlFor="editIsAdmin" className="ml-2 block text-sm text-gray-700 dark:text-slate-300">
                      Admin Store
                    </label>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(false)
                        setEditingStore(null)
                        resetForm()
                      }}
                      className="px-4 py-2 text-gray-600 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isUpdating}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isUpdating ? 'Updating...' : 'Update Store'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  )
}
