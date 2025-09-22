'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Layout from '@/components/Layout'
import { Plus, Search, Edit, Trash2, Upload, Download, FileSpreadsheet } from 'lucide-react'

interface User {
  _id: string
  customId: string
  name: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export default function UsersPage() {
  const { store } = useAuth()
  const { success, error } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  // Pagination and sorting states
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)
  const [sortField, setSortField] = useState<keyof User>('createdAt')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [totalUsers, setTotalUsers] = useState(0)
  
  // Form states
  const [formData, setFormData] = useState({
    customId: '',
    name: ''
  })
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  
  // Loading states
  const [submitting, setSubmitting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({})

  useEffect(() => {
    if (!store) {
      // If no store (logged out), redirect to login
      window.location.href = '/login'
      return
    }
    if (!store.isAdmin) {
      // If store exists but not admin, redirect to dashboard
      window.location.href = '/'
      return
    }
    fetchUsers()
  }, [store])

  // Refetch when pagination or sorting changes
  useEffect(() => {
    if (store?.isAdmin) {
      fetchUsers()
    }
  }, [currentPage, itemsPerPage, sortField, sortDirection, searchTerm])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
        sortField: sortField,
        sortDirection: sortDirection,
        ...(searchTerm && { search: searchTerm })
      })

      const response = await fetch(`/api/users?${params}`)
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || data) // Handle both paginated and simple response
        setTotalUsers(data.total || data.length || 0)
      } else {
        console.error('Failed to fetch users')
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSubmitting(true)

    if (!formData.customId.trim()) {
      setErrors({ customId: 'Customer ID is required' })
      setSubmitting(false)
      return
    }
    if (!formData.name.trim()) {
      setErrors({ name: 'Name is required' })
      setSubmitting(false)
      return
    }

    try {
      const url = editingUser ? `/api/users/${editingUser._id}` : '/api/users'
      const method = editingUser ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        await fetchUsers()
        resetForm()
        setShowCreateModal(false)
        setEditingUser(null)
      } else {
        const error = await response.json()
        setErrors({ submit: error.message || 'Failed to save user' })
      }
    } catch (error) {
      setErrors({ submit: 'Error saving user' })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setFormData({ customId: '', name: '' })
    setErrors({})
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      customId: user.customId,
      name: user.name
    })
    setShowCreateModal(true)
  }

  const handleDelete = async (userId: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this user?')
    if (!confirmed) return

    setActionLoading({ ...actionLoading, [`delete-${userId}`]: true })
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        await fetchUsers()
        success('User deleted successfully!')
      } else {
        error('Failed to delete user', 'Delete Failed')
      }
    } catch (err) {
      error('Error deleting user', 'Delete Failed')
    } finally {
      setActionLoading({ ...actionLoading, [`delete-${userId}`]: false })
    }
  }

  const handleToggleActive = async (user: User) => {
    setActionLoading({ ...actionLoading, [`toggle-${user._id}`]: true })
    try {
      const response = await fetch(`/api/users/${user._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customId: user.customId,
          name: user.name,
          isActive: !user.isActive
        }),
      })

      if (response.ok) {
        await fetchUsers()
        success(`User ${user.isActive ? 'deactivated' : 'activated'} successfully!`)
      } else {
        error('Failed to update user status', 'Update Failed')
      }
    } catch (err) {
      error('Error updating user status', 'Update Failed')
    } finally {
      setActionLoading({ ...actionLoading, [`toggle-${user._id}`]: false })
    }
  }

  // Handle sorting
  const handleSort = (field: keyof User) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1) // Reset to first page when sorting
  }

  // Handle search with debouncing
  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // Reset to first page when searching
  }

  // Calculate pagination info
  const totalPages = Math.ceil(totalUsers / itemsPerPage)
  const startItem = (currentPage - 1) * itemsPerPage + 1
  const endItem = Math.min(currentPage * itemsPerPage, totalUsers)

  const exportToExcel = async () => {
    setExporting(true)
    try {
      // Fetch all users for export (without pagination)
      const response = await fetch('/api/users?limit=1000')
      if (!response.ok) {
        error('Failed to fetch users for export', 'Export Failed')
        return
      }

      const data = await response.json()
      const allUsers = data.users || data

      const XLSX = await import('xlsx')
      
      const worksheet = XLSX.utils.json_to_sheet(
        allUsers.map((user: User) => ({
          'Customer ID': user.customId,
          'Name': user.name,
          'Status': user.isActive ? 'Active' : 'Inactive',
          'Created Date': new Date(user.createdAt).toLocaleDateString()
        }))
      )
      
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Users')
      
      XLSX.writeFile(workbook, `users_${new Date().toISOString().split('T')[0]}.xlsx`)
    } catch (err) {
      console.error('Export error:', err)
      error('Failed to export users', 'Export Failed')
    } finally {
      setExporting(false)
    }
  }

  if (!store || !store.isAdmin) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600">Only administrators can access user management.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-4 px-4 sm:px-0">
        {/* Header */}
        <div className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 rounded-xl p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold gradient-text">User Management</h1>
              <p className="text-slate-600 dark:text-slate-400">Manage customer accounts and access</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={exportToExcel}
                disabled={exporting}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white font-medium hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {exporting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Excel
                  </>
                )}
              </button>
              <button
                onClick={() => setShowBulkModal(true)}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-colors shadow-lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                Bulk Import
              </button>
              <button
                onClick={() => {
                  resetForm()
                  setEditingUser(null)
                  setShowCreateModal(true)
                }}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-medium hover:from-purple-600 hover:to-indigo-700 transition-colors shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add User
              </button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search users by name or customer ID..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              />
          </div>
        </div>

        {/* Users Table */}
        <div className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg overflow-hidden max-h-[70vh] flex flex-col">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-slate-500 dark:text-slate-400">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">No users found</p>
            </div>
          ) : (
            <>
            <div className="overflow-auto flex-1">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                <thead className="bg-slate-50/50 dark:bg-slate-800/50">
                  <tr>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('customId')}
                        className="flex items-center space-x-1 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        <span>Customer ID</span>
                        {sortField === 'customId' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('name')}
                        className="flex items-center space-x-1 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        <span>Name</span>
                        {sortField === 'name' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      <button
                        onClick={() => handleSort('isActive')}
                        className="flex items-center space-x-1 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        <span>Status</span>
                        {sortField === 'isActive' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                      <button
                        onClick={() => handleSort('createdAt')}
                        className="flex items-center space-x-1 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        <span>Created</span>
                        {sortField === 'createdAt' && (
                          <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </button>
                    </th>
                    <th className="px-2 sm:px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {users.map((user) => (
                    <tr key={user._id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-slate-100">
                        {user.customId}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-slate-100">
                        <div className="max-w-[120px] sm:max-w-none truncate">{user.name}</div>
                      </td>
                      <td className="px-2 sm:px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={actionLoading[`toggle-${user._id}`]}
                          className={`inline-flex items-center px-2 sm:px-3 py-1 text-xs font-semibold rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            user.isActive
                              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/50'
                          }`}
                        >
                          {actionLoading[`toggle-${user._id}`] ? (
                            <>
                              <div className="animate-spin rounded-full h-3 w-3 border-b border-current mr-1"></div>
                              Updating...
                            </>
                          ) : (
                            user.isActive ? 'Active' : 'Inactive'
                          )}
                        </button>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2 sm:space-x-3">
                          <button
                            onClick={() => handleEdit(user)}
                            disabled={actionLoading[`toggle-${user._id}`] || actionLoading[`delete-${user._id}`]}
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <Edit className="h-4 w-4 sm:h-5 sm:w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(user._id)}
                            disabled={actionLoading[`delete-${user._id}`] || actionLoading[`toggle-${user._id}`]}
                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {actionLoading[`delete-${user._id}`] ? (
                              <div className="animate-spin rounded-full h-4 w-4 sm:h-5 sm:w-5 border-b border-current"></div>
                            ) : (
                              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls - Fixed at bottom */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-inherit flex-shrink-0">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Showing {startItem} to {endItem} of {totalUsers} users
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Items per page selector */}
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value))
                      setCurrentPage(1)
                    }}
                    className="text-sm border border-slate-300 dark:border-slate-600 rounded-md px-3 py-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  >
                    <option value={5}>5 per page</option>
                    <option value={10}>10 per page</option>
                    <option value={20}>20 per page</option>
                    <option value={50}>50 per page</option>
                  </select>
                  
                  {/* Pagination buttons */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    
                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum
                      if (totalPages <= 5) {
                        pageNum = i + 1
                      } else if (currentPage <= 3) {
                        pageNum = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i
                      } else {
                        pageNum = currentPage - 2 + i
                      }
                      
                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md ${
                            currentPage === pageNum
                              ? 'bg-blue-500 text-white border-blue-500'
                              : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700'
                          }`}
                        >
                          {pageNum}
                        </button>
                      )
                    })}
                    
                    <button
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
          )}
        </div>

        {/* Create/Edit User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="backdrop-blur-md bg-white/95 dark:bg-slate-900/95 rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200/50 dark:border-slate-700/50 shadow-2xl mx-4">
              <div className="p-6">
                <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
                  {editingUser ? 'Edit User' : 'Create New User'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Customer ID *
                    </label>
                    <input
                      type="text"
                      value={formData.customId}
                      onChange={(e) => setFormData({ ...formData, customId: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Enter unique customer ID"
                    />
                    {errors.customId && (
                      <p className="mt-1 text-sm text-red-500">{errors.customId}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Enter customer name"
                    />
                    {errors.name && (
                      <p className="mt-1 text-sm text-red-500">{errors.name}</p>
                    )}
                  </div>

                  {errors.submit && (
                    <p className="text-sm text-red-500">{errors.submit}</p>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false)
                        setEditingUser(null)
                        resetForm()
                      }}
                      className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg"
                    >
                      {submitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 inline-block"></div>
                          {editingUser ? 'Updating...' : 'Creating...'}
                        </>
                      ) : (
                        `${editingUser ? 'Update' : 'Create'} User`
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Import Modal */}
        {showBulkModal && (
          <BulkImportModal
            onClose={() => setShowBulkModal(false)}
            onSuccess={fetchUsers}
          />
        )}
      </div>
    </Layout>
  )
}

// Bulk Import Component
function BulkImportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [preview, setPreview] = useState<any[]>([])

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx')
    
    const templateData = [
      { customId: '001', name: 'John Doe' },
      { customId: '002', name: 'Jane Smith' },
      { customId: '003', name: 'Bob Johnson' }
    ]
    
    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users')
    
    XLSX.writeFile(workbook, 'users_template.xlsx')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      parseFile(selectedFile)
    }
  }

  const parseFile = async (file: File) => {
    try {
      const XLSX = await import('xlsx')
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          
          if (jsonData.length === 0) {
            setErrors(['File is empty'])
            return
          }
          
          const headers = (jsonData[0] as string[]).map(h => String(h).trim())
          
          if (headers[0] !== 'customId' || headers[1] !== 'name') {
            setErrors(['Invalid file format. Expected columns: customId, name'])
            return
          }
          
          const dataRows = jsonData.slice(1).map((row: any, index) => {
            const values = Array.isArray(row) ? row : []
            return {
              line: index + 2,
              customId: String(values[0] || '').trim(),
              name: String(values[1] || '').trim()
            }
          }).filter(row => row.customId && row.name)
          
          setPreview(dataRows)
          setErrors([])
        } catch (error) {
          console.error('Error parsing Excel file:', error)
          setErrors(['Failed to parse Excel file. Please check the format.'])
        }
      }
      
      reader.readAsArrayBuffer(file)
    } catch (error) {
      console.error('Error loading xlsx library:', error)
      setErrors(['Failed to load Excel parser. Please try again.'])
    }
  }

  const handleUpload = async () => {
    if (!file || preview.length === 0) return

    setUploading(true)
    setErrors([])

    try {
      const response = await fetch('/api/users/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ users: preview }),
      })

      const result = await response.json()

      if (response.ok) {
        onSuccess()
        onClose()
      } else {
        setErrors(result.errors || [result.message])
      }
    } catch (error) {
      setErrors(['Upload failed. Please try again.'])
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="backdrop-blur-md bg-white/95 dark:bg-slate-900/95 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200/50 dark:border-slate-700/50 shadow-2xl mx-4">
        <div className="p-6">
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">Bulk Import Users</h2>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-6 text-center bg-slate-50/50 dark:bg-slate-800/50">
              <FileSpreadsheet className="h-12 w-12 text-slate-400 mx-auto mb-4" />
              <div className="space-y-2">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Upload an Excel file with customer data
                </p>
                <div className="flex flex-col sm:flex-row gap-2 justify-center">
                  <button
                    onClick={downloadTemplate}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-sm font-medium transition-colors"
                  >
                    Download Template
                  </button>
                  <label className="cursor-pointer text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 text-sm font-medium transition-colors">
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </label>
                </div>
                {file && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                    Selected: {file.name}
                  </p>
                )}
              </div>
            </div>

            {preview.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                  Preview ({preview.length} users)
                </h3>
                <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50/50 dark:bg-slate-800/50">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100/50 dark:bg-slate-700/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-700 dark:text-slate-300">Customer ID</th>
                        <th className="px-3 py-2 text-left text-slate-700 dark:text-slate-300">Name</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 10).map((row, index) => (
                        <tr key={index} className="border-t border-slate-200 dark:border-slate-700">
                          <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{row.customId}</td>
                          <td className="px-3 py-2 text-slate-900 dark:text-slate-100">{row.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.length > 10 && (
                    <p className="p-2 text-center text-slate-500 dark:text-slate-400 text-xs">
                      ... and {preview.length - 10} more
                    </p>
                  )}
                </div>
              </div>
            )}

            {errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <h4 className="text-sm font-medium text-red-800 dark:text-red-400 mb-1">Errors:</h4>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || preview.length === 0 || uploading}
                className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 disabled:from-slate-400 disabled:to-slate-500 disabled:cursor-not-allowed transition-colors shadow-lg"
              >
                {uploading ? 'Uploading...' : `Import ${preview.length} Users`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
