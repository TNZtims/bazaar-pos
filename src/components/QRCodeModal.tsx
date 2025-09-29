'use client'

import { useState } from 'react'

interface QRCodeModalProps {
  isOpen: boolean
  onClose: () => void
  qrCodes: {
    gcash?: string
    gotyme?: string
    bpi?: string
  }
  storeName: string
}

export default function QRCodeModal({ isOpen, onClose, qrCodes, storeName }: QRCodeModalProps) {
  const [selectedProvider, setSelectedProvider] = useState<'gcash' | 'gotyme' | 'bpi'>('gcash')

  if (!isOpen) return null

  const providers = [
    {
      id: 'gcash' as const,
      name: 'GCash',
      color: 'bg-blue-600',
      hoverColor: 'hover:bg-blue-700',
      borderColor: 'border-blue-600',
      textColor: 'text-blue-600',
      available: !!qrCodes.gcash
    },
    {
      id: 'gotyme' as const,
      name: 'GoTyme',
      color: 'bg-green-600',
      hoverColor: 'hover:bg-green-700',
      borderColor: 'border-green-600',
      textColor: 'text-green-600',
      available: !!qrCodes.gotyme
    },
    {
      id: 'bpi' as const,
      name: 'BPI',
      color: 'bg-red-600',
      hoverColor: 'hover:bg-red-700',
      borderColor: 'border-red-600',
      textColor: 'text-red-600',
      available: !!qrCodes.bpi
    }
  ]

  const availableProviders = providers.filter(p => p.available)
  
  // Set default selected provider to first available one
  if (availableProviders.length > 0 && !availableProviders.find(p => p.id === selectedProvider)) {
    setSelectedProvider(availableProviders[0].id)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-20 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-600">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100">
              Payment QR Codes
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mt-1">
              {storeName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row min-h-[500px]">
          {availableProviders.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 011-1h2m0 0V4a1 1 0 011-1h1m0 0h2a1 1 0 011 1v1M9 7h1m4 0h1m-5.01 0h.01M12 9v.01" />
                </svg>
                <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100 mb-2">
                  No Payment QR Codes Available
                </h4>
                <p className="text-gray-600 dark:text-slate-400">
                  The store hasn't set up any payment QR codes yet.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Left Side - Controls and Instructions */}
              <div className="lg:w-80 p-6 bg-gray-50 dark:bg-slate-900/50 border-r border-gray-200 dark:border-slate-600">
                {/* Provider Selection */}
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-3">
                    Select Payment Method:
                  </h4>
                  <div className="space-y-2">
                    {availableProviders.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => setSelectedProvider(provider.id)}
                        className={`w-full px-4 py-3 rounded-lg border-2 transition-all duration-200 text-left ${
                          selectedProvider === provider.id
                            ? `${provider.color} text-white ${provider.borderColor}`
                            : `bg-white dark:bg-slate-700 ${provider.textColor} dark:text-slate-300 ${provider.borderColor} dark:border-slate-600 ${provider.hoverColor} hover:text-white`
                        }`}
                      >
                        <div className="flex items-center">
                          <div className={`w-3 h-3 rounded-full mr-3 ${
                            selectedProvider === provider.id ? 'bg-white' : provider.color
                          }`}></div>
                          {provider.name}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Current Selection Info */}
                <div className="mb-6 p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-600">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-3 ${
                    availableProviders.find(p => p.id === selectedProvider)?.color
                  } text-white`}>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 011-1h2m0 0V4a1 1 0 011-1h1m0 0h2a1 1 0 011 1v1M9 7h1m4 0h1m-5.01 0h.01M12 9v.01" />
                    </svg>
                    {availableProviders.find(p => p.id === selectedProvider)?.name}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-400">
                    Scan the QR code with your {availableProviders.find(p => p.id === selectedProvider)?.name} app
                  </p>
                </div>

                {/* Instructions */}
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <h5 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-3">
                    How to pay:
                  </h5>
                  <ol className="text-sm text-blue-800 dark:text-blue-400 space-y-2">
                    <li className="flex items-start">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">1</span>
                      Open your {availableProviders.find(p => p.id === selectedProvider)?.name} app
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">2</span>
                      Scan the QR code
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">3</span>
                      Enter the payment amount
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">4</span>
                      Complete the transaction
                    </li>
                    <li className="flex items-start">
                      <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center mr-2 mt-0.5 flex-shrink-0">5</span>
                      Show the receipt to the cashier
                    </li>
                  </ol>
                </div>
              </div>

              {/* Right Side - QR Code Display */}
              <div className="flex-1 flex items-center justify-center p-8 bg-white dark:bg-slate-800">
                <div className="w-[653px] h-[653px] flex items-center justify-center">
                  {qrCodes[selectedProvider] ? (
                    <img
                      src={qrCodes[selectedProvider]}
                      alt={`${availableProviders.find(p => p.id === selectedProvider)?.name} QR Code`}
                      className="w-full h-full object-contain rounded-lg shadow-lg"
                      style={{ imageRendering: 'pixelated' }}
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ci8+CjxwYXRoIGQ9Ik0xNTAgMTcwQzE2MS4wNDYgMTcwIDE3MCAxNjEuMDQ2IDE3MCAxNTBDMTcwIDEzOC45NTQgMTYxLjA0NiAxMzAgMTUwIDEzMEMxMzguOTU0IDEzMCAxMzAgMTM4Ljk1NCAxMzAgMTUwQzEzMCAxNjEuMDQ2IDEzOC45NTQgMTcwIDE1MCAxNzBaIiBmaWxsPSIjOUNBM0FGIi8+Cjx0ZXh0IHg9IjE1MCIgeT0iMjEwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjOUNBM0FGIiBmb250LXNpemU9IjE2Ij5RUiBDb2RlIE5vdCBBdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPgo='
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg">
                      <div className="text-center">
                        <svg className="w-20 h-20 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V6a1 1 0 011-1h2m0 0V4a1 1 0 011-1h1m0 0h2a1 1 0 011 1v1M9 7h1m4 0h1m-5.01 0h.01M12 9v.01" />
                        </svg>
                        <p className="text-base text-gray-500 dark:text-slate-400">
                          QR Code not available
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
