'use client'

interface WebSocketStatusProps {
  isConnected: boolean
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected'
  error: string | null
  reconnectAttempts: number
  className?: string
}

export default function WebSocketStatus({ 
  isConnected, 
  connectionQuality, 
  error, 
  reconnectAttempts,
  className = '' 
}: WebSocketStatusProps) {
  const getStatusColor = () => {
    if (!isConnected) return 'bg-red-500'
    
    switch (connectionQuality) {
      case 'excellent': return 'bg-green-500'
      case 'good': return 'bg-yellow-500'
      case 'poor': return 'bg-orange-500'
      default: return 'bg-red-500'
    }
  }

  const getStatusText = () => {
    if (!isConnected) {
      if (reconnectAttempts > 0) {
        return `Reconnecting... (${reconnectAttempts})`
      }
      return 'Disconnected'
    }
    
    switch (connectionQuality) {
      case 'excellent': return 'Real-time updates active'
      case 'good': return 'Connected'
      case 'poor': return 'Slow connection'
      default: return 'Connected'
    }
  }

  const getIcon = () => {
    if (!isConnected) {
      return (
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )
    }

    return (
      <div className={`w-3 h-3 rounded-full ${getStatusColor()} ${connectionQuality === 'excellent' ? 'animate-pulse' : ''}`}></div>
    )
  }

  return (
    <div className={`flex items-center gap-2 text-xs ${className}`}>
      {getIcon()}
      <span className={`font-medium ${
        isConnected 
          ? 'text-gray-700 dark:text-gray-300' 
          : 'text-red-600 dark:text-red-400'
      }`}>
        {getStatusText()}
      </span>
      {error && !isConnected && (
        <span className="text-red-500 dark:text-red-400 text-xs">
          ({error})
        </span>
      )}
    </div>
  )
}
