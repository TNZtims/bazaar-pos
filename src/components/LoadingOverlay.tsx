'use client'

interface LoadingOverlayProps {
  isVisible: boolean
  title: string
  message: string
  color?: 'blue' | 'green' | 'red' | 'purple' | 'orange'
}

export default function LoadingOverlay({ 
  isVisible, 
  title, 
  message, 
  color = 'blue' 
}: LoadingOverlayProps) {
  if (!isVisible) return null

  const colorClasses = {
    blue: {
      spinner: 'border-t-blue-600 dark:border-t-blue-400',
      ping: 'border-t-blue-600/20 dark:border-t-blue-400/20'
    },
    green: {
      spinner: 'border-t-green-600 dark:border-t-green-400',
      ping: 'border-t-green-600/20 dark:border-t-green-400/20'
    },
    red: {
      spinner: 'border-t-red-600 dark:border-t-red-400',
      ping: 'border-t-red-600/20 dark:border-t-red-400/20'
    },
    purple: {
      spinner: 'border-t-purple-600 dark:border-t-purple-400',
      ping: 'border-t-purple-600/20 dark:border-t-purple-400/20'
    },
    orange: {
      spinner: 'border-t-orange-600 dark:border-t-orange-400',
      ping: 'border-t-orange-600/20 dark:border-t-orange-400/20'
    }
  }

  const currentColor = colorClasses[color]

  return (
    <div className="fixed inset-0 bg-black/20 dark:bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 mx-4 max-w-sm w-full border border-gray-200 dark:border-slate-700">
        <div className="flex flex-col items-center">
          <div className="relative">
            <div className={`w-16 h-16 border-4 border-gray-200 dark:border-slate-700 rounded-full animate-spin ${currentColor.spinner}`}></div>
            <div className={`absolute inset-0 w-16 h-16 border-4 border-transparent rounded-full animate-ping ${currentColor.ping}`}></div>
          </div>
          <div className="mt-6 text-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {message}
            </p>
          </div>
          <div className="flex space-x-1 mt-4">
            <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-gray-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  )
}
