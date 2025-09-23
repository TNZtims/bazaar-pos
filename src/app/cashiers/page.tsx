'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import Layout from '@/components/Layout'
import { Plus, Edit, Trash2 } from 'lucide-react'

export default function CashiersPage() {
  const { store } = useAuth()
  const { success, error } = useToast()
  const [cashiers, setCashiers] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState<{ [key: string]: boolean }>({})
  const [showModal, setShowModal] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [cashierName, setCashierName] = useState('')
  const [errors, setErrors] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    if (!store) {
      window.location.href = '/login'
      return
    }
    loadCashiers()
  }, [store])

  const loadCashiers = () => {
    if (store?.cashiers) {
      setCashiers(store.cashiers)
    }
    setLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setSubmitting(true)

    if (!cashierName.trim()) {
      setErrors({ name: 'Cashier name is required' })
      setSubmitting(false)
      return
    }

    // Check for duplicates
    if (editingIndex === null && cashiers.includes(cashierName.trim())) {
      setErrors({ name: 'Cashier already exists' })
      setSubmitting(false)
      return
    }

    try {
      let updatedCashiers
      
      if (editingIndex !== null) {
        // Edit existing cashier
        updatedCashiers = [...cashiers]
        updatedCashiers[editingIndex] = cashierName.trim()
      } else {
        // Add new cashier
        updatedCashiers = [...cashiers, cashierName.trim()]
      }

      const response = await fetch('/api/stores/cashiers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cashiers: updatedCashiers }),
      })

      if (response.ok) {
        setCashiers(updatedCashiers)
        resetForm()
        setShowModal(false)
        success(editingIndex !== null ? 'Cashier updated successfully!' : 'Cashier added successfully!')
        
        // Note: Store cashiers will be updated on next auth check
        // No need to reload the page
      } else {
        const errorData = await response.json()
        error(errorData.message || 'Failed to update cashiers', 'Operation Failed')
      }
    } catch (error) {
      setErrors({ submit: 'Error updating cashiers' })
    } finally {
      setSubmitting(false)
    }
  }

  const resetForm = () => {
    setCashierName('')
    setEditingIndex(null)
    setErrors({})
  }

  const handleEdit = (index: number) => {
    setEditingIndex(index)
    setCashierName(cashiers[index])
    setShowModal(true)
  }

  const handleDelete = async (index: number) => {
    const confirmed = window.confirm(`Are you sure you want to remove "${cashiers[index]}"?`)
    if (!confirmed) return

    setDeleting({ ...deleting, [index]: true })
    try {
      const updatedCashiers = cashiers.filter((_, i) => i !== index)

      const response = await fetch('/api/stores/cashiers', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ cashiers: updatedCashiers }),
      })

      if (response.ok) {
        setCashiers(updatedCashiers)
        success('Cashier removed successfully!')
        
        // Note: Store cashiers will be updated on next auth check
        // No need to reload the page
      } else {
        error('Failed to remove cashier', 'Delete Failed')
      }
    } catch (err) {
      error('Error removing cashier', 'Delete Failed')
    } finally {
      setDeleting({ ...deleting, [index]: false })
    }
  }

  if (!store) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center bg-red-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
            <p className="text-gray-600">Please log in to access cashier management.</p>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6 px-4 sm:px-0">
        {/* Header */}
        <div className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 rounded-xl p-6 border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold gradient-text">Cashier Management</h1>
              <p className="text-slate-600 dark:text-slate-400">Manage cashiers for your store</p>
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowModal(true)
              }}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-colors shadow-lg"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Cashier
            </button>
          </div>
        </div>

        {/* Cashiers List */}
        <div className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 rounded-xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg max-h-[60vh] overflow-auto">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-slate-500 dark:text-slate-400">Loading cashiers...</p>
            </div>
          ) : cashiers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-slate-500 dark:text-slate-400">No cashiers added yet</p>
              <button
                onClick={() => {
                  resetForm()
                  setShowModal(true)
                }}
                className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-medium hover:from-blue-600 hover:to-indigo-700 transition-colors shadow-lg"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add First Cashier
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {cashiers.map((cashier, index) => (
                <div key={index} className="p-4 sm:p-6 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                      <span className="text-white font-semibold text-sm">
                        {cashier.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                        {cashier}
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        Cashier #{index + 1}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleEdit(index)}
                      disabled={deleting[index] || submitting}
                      className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      disabled={deleting[index] || submitting}
                      className="p-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting[index] ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b border-current"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add/Edit Cashier Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="backdrop-blur-md bg-white/95 dark:bg-slate-900/95 rounded-xl max-w-md w-full border border-slate-200/50 dark:border-slate-700/50 shadow-2xl mx-4">
              <div className="p-6">
                <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-4">
                  {editingIndex !== null ? 'Edit Cashier' : 'Add New Cashier'}
                </h2>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Cashier Name *
                    </label>
                    <input
                      type="text"
                      value={cashierName}
                      onChange={(e) => setCashierName(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg bg-slate-50/50 dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-700/50 text-slate-900 dark:text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                      placeholder="Enter cashier name"
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
                        setShowModal(false)
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
                          {editingIndex !== null ? 'Updating...' : 'Adding...'}
                        </>
                      ) : (
                        `${editingIndex !== null ? 'Update' : 'Add'} Cashier`
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}
