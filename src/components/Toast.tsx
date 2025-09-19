'use client'

import React, { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
  persistent?: boolean
}

interface ToastComponentProps {
  toast: Toast
  onRemove: (id: string) => void
}

const ToastComponent: React.FC<ToastComponentProps> = ({ toast, onRemove }) => {
  const { id, type, title, message, duration = 5000, persistent = false } = toast

  useEffect(() => {
    if (!persistent) {
      const timer = setTimeout(() => {
        onRemove(id)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [id, duration, persistent, onRemove])

  const getToastStyles = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200'
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-800 dark:text-yellow-200'
      case 'info':
        return 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800 dark:bg-gray-900/20 dark:border-gray-800 dark:text-gray-200'
    }
  }

  const getIcon = () => {
    const iconClass = "h-6 w-6 flex-shrink-0"
    switch (type) {
      case 'success':
        return <CheckCircle className={iconClass} />
      case 'error':
        return <AlertCircle className={iconClass} />
      case 'warning':
        return <AlertTriangle className={iconClass} />
      case 'info':
        return <Info className={iconClass} />
      default:
        return <Info className={iconClass} />
    }
  }

  return (
    <div
      className={`
        relative w-full max-w-md sm:max-w-lg p-5 rounded-xl border shadow-xl
        transform transition-all duration-300 ease-in-out
        animate-in slide-in-from-right-full
        ${getToastStyles()}
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <p className="font-semibold text-base mb-1">
              {title}
            </p>
          )}
          <p className="text-base">
            {message}
          </p>
        </div>
        <button
          onClick={() => onRemove(id)}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

export default ToastComponent
