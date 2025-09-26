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
        return 'bg-green-500 text-white dark:bg-green-600 dark:text-white'
      case 'error':
        return 'bg-red-500 text-white dark:bg-red-600 dark:text-white'
      case 'warning':
        return 'bg-yellow-500 text-white dark:bg-yellow-600 dark:text-white'
      case 'info':
        return 'bg-blue-500 text-white dark:bg-blue-600 dark:text-white'
      default:
        return 'bg-gray-500 text-white dark:bg-gray-600 dark:text-white'
    }
  }

  const getIcon = () => {
    const iconClass = "h-4 w-4 flex-shrink-0"
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
        relative w-full max-w-xs sm:max-w-sm p-3 rounded-lg shadow-lg
        transform transition-all duration-300 ease-in-out
        animate-in slide-in-from-right-full
        ${getToastStyles()}
      `}
    >
      <div className="flex items-start space-x-2">
        <div className="flex-shrink-0">
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          {title && (
            <p className="font-semibold text-sm mb-0.5">
              {title}
            </p>
          )}
          <p className="text-sm">
            {message}
          </p>
        </div>
        <button
          onClick={() => onRemove(id)}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default ToastComponent
