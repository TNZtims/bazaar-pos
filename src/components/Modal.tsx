'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
  showCloseButton?: boolean
  closeOnBackdropClick?: boolean
  preventBodyScroll?: boolean
  className?: string
}

const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  preventBodyScroll = true,
  className = ''
}: ModalProps) => {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (!preventBodyScroll) return

    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow
      document.body.style.overflow = 'hidden'
      
      return () => {
        document.body.style.overflow = originalStyle
      }
    }
  }, [isOpen, preventBodyScroll])

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      return () => document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-7xl'
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose()
    }
  }

  const modalContent = (
    <div 
      className="modal-overlay fixed inset-0 z-[1000] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm safe-top safe-bottom safe-left safe-right"
      onClick={handleBackdropClick}
    >
      <div 
        className={`
          modal-content relative w-full bg-white dark:bg-slate-800 rounded-lg shadow-xl 
          border border-slate-200 dark:border-slate-700
          max-h-[95vh] sm:max-h-[90vh] flex flex-col
          transform transition-all duration-200 ease-out
          animate-in slide-in-from-bottom-4 fade-in-0
          ${sizeClasses[size]}
          ${className}
        `}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            {title && (
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-slate-100 pr-4">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="modal-close-button flex-shrink-0 p-2 -m-2 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 
                         transition-colors rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 sm:p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  )

  // Render modal in portal to body
  return typeof window !== 'undefined' 
    ? createPortal(modalContent, document.body)
    : null
}

export default Modal

// Confirmation Modal Component
interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  type?: 'danger' | 'warning' | 'info'
  confirmText?: string
  cancelText?: string
  loading?: boolean
}

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  loading = false
}: ConfirmationModalProps) => {
  const iconConfig = {
    danger: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      color: 'text-red-600 dark:text-red-400',
      buttonBg: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
    },
    warning: {
      bg: 'bg-yellow-100 dark:bg-yellow-900/30',
      color: 'text-yellow-600 dark:text-yellow-400',
      buttonBg: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500'
    },
    info: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      color: 'text-blue-600 dark:text-blue-400',
      buttonBg: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
    }
  }

  const config = iconConfig[type]

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm" showCloseButton={false}>
      <div className="flex items-start space-x-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.bg}`}>
          {type === 'danger' ? (
            <svg className={`w-6 h-6 ${config.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          ) : (
            <svg className={`w-6 h-6 ${config.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-100 mb-2">
            {title}
          </h3>
          <p className="text-sm text-slate-400 whitespace-pre-line">
            {message}
          </p>
        </div>
      </div>

      <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-slate-700">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 
                   border border-slate-600 rounded-lg hover:bg-slate-600 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className={`px-4 py-2 text-sm font-medium text-white rounded-lg 
                    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800
                    disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                    ${config.buttonBg} ${loading ? 'cursor-wait' : ''}`}
        >
          {loading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Loading...</span>
            </div>
          ) : (
            confirmText
          )}
        </button>
      </div>
    </Modal>
  )
}
