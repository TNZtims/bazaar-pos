'use client'

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import ToastComponent, { Toast, ToastType } from '@/components/Toast'

interface ToastContextType {
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  success: (message: string, title?: string, options?: Partial<Toast>) => void
  error: (message: string, title?: string, options?: Partial<Toast>) => void
  warning: (message: string, title?: string, options?: Partial<Toast>) => void
  info: (message: string, title?: string, options?: Partial<Toast>) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

interface ToastProviderProps {
  children: ReactNode
}

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: Toast = { ...toast, id }
    
    setToasts(prev => [...prev, newToast])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }, [])

  const success = useCallback((message: string, title?: string, options?: Partial<Toast>) => {
    addToast({
      type: 'success',
      message,
      title,
      ...options
    })
  }, [addToast])

  const error = useCallback((message: string, title?: string, options?: Partial<Toast>) => {
    addToast({
      type: 'error',
      message,
      title,
      duration: 7000, // Longer duration for errors
      ...options
    })
  }, [addToast])

  const warning = useCallback((message: string, title?: string, options?: Partial<Toast>) => {
    addToast({
      type: 'warning',
      message,
      title,
      ...options
    })
  }, [addToast])

  const info = useCallback((message: string, title?: string, options?: Partial<Toast>) => {
    addToast({
      type: 'info',
      message,
      title,
      ...options
    })
  }, [addToast])

  const contextValue: ToastContextType = {
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  }

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      
      {/* Toast Container */}
      <div className="fixed top-20 right-4 z-[100] space-y-3 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastComponent
              toast={toast}
              onRemove={removeToast}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export default ToastProvider
