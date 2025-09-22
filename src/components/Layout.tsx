'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'

interface LayoutProps {
  children: React.ReactNode
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { mounted } = useTheme()
  const { store, logout } = useAuth()
  const { success } = useToast()

  const handleLogout = async () => {
    await logout()
    success('Logged out successfully')
  }

  // Don't render theme-dependent content until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen bg-slate-100 animate-pulse">
        <div className="flex items-center justify-center h-screen">
          <div className="text-slate-600">Loading...</div>
        </div>
      </div>
    )
  }

  const navigation = [
    { name: 'Dashboard', href: '/', icon: '🏠', gradient: 'from-blue-500 to-purple-600' },
    { name: 'Products', href: '/products', icon: '📦', gradient: 'from-green-500 to-teal-600' },
    { name: 'Sales', href: '/sales', icon: '💰', gradient: 'from-yellow-500 to-orange-600' },
    { name: 'Orders', href: '/orders', icon: '📋', gradient: 'from-purple-500 to-indigo-600' },
    ...(store?.isAdmin ? [
      { name: 'Users', href: '/users', icon: '👥', gradient: 'from-cyan-500 to-blue-600' },
      { name: 'Cashiers', href: '/cashiers', icon: '💼', gradient: 'from-emerald-500 to-teal-600' }
    ] : []),
    { name: 'Sales History', href: '/sales/history', icon: '📊', gradient: 'from-indigo-500 to-purple-600' },
    { name: 'Reports', href: '/reports', icon: '📈', gradient: 'from-pink-500 to-rose-600' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-indigo-900 transition-all duration-500">
      {/* Mobile header */}
      <div className="lg:hidden">
        <div className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 border-b border-slate-200/50 dark:border-slate-700/50 px-4 py-3 sticky top-0 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <h1 className="text-xl font-bold gradient-text">BzPOS</h1>
            </div>
            <div className="flex items-center space-x-2">
            {/* Dark Mode Only - No Toggle Needed */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg bg-slate-100/50 dark:bg-slate-800/50 border border-slate-300/50 dark:border-slate-600/50 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors duration-200 safe-transform"
              >
                <span className="sr-only">Open sidebar</span>
                {sidebarOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="lg:flex">
        {/* Sidebar */}
        <div className={`
          lg:w-72 lg:flex-shrink-0
          ${sidebarOpen ? 'block' : 'hidden'} lg:block
          fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40 lg:z-0 lg:h-screen w-72
        `}>
          <div className="h-full lg:h-screen backdrop-blur-md bg-white/95 dark:bg-slate-900/95 border-r border-slate-200/50 dark:border-slate-700/50 shadow-lg lg:shadow-none overflow-y-auto">
            {/* Logo */}
            <div className="hidden lg:flex items-center justify-between px-6 py-6 border-b border-slate-200/50 dark:border-slate-700/50">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">P</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold gradient-text">BzPOS</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{store?.storeName || 'Point of Sale'}</p>
                </div>
              </div>
              {/* Dark Mode Only - No Toggle Needed */}
            </div>

            {/* Navigation */}
            <nav className="mt-6 lg:mt-0 px-4">
              <div className="space-y-2">
                {navigation.map((item, index) => {
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        group flex items-center px-4 py-3 text-sm font-medium rounded-xl relative overflow-hidden safe-transform
                        transition-colors duration-200 ease-in-out
                        ${isActive
                          ? `bg-gradient-to-r ${item.gradient} text-white shadow-lg transform scale-105`
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50'
                        }
                      `}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className={`
                        w-10 h-10 rounded-lg flex items-center justify-center mr-3 transition-colors duration-200 safe-transform
                        ${isActive 
                          ? 'bg-white/20 backdrop-blur-sm' 
                          : 'bg-slate-100/30 dark:bg-slate-700/30 group-hover:bg-slate-200/40 dark:group-hover:bg-slate-600/40'
                        }
                      `}>
                        <span className="text-lg">{item.icon}</span>
                      </div>
                      <div className="flex-1">
                        <span className="block">{item.name}</span>
                        {isActive && (
                          <div className="w-full h-0.5 bg-white/30 rounded-full mt-1 animate-pulse-custom" />
                        )}
                      </div>
                      {isActive && (
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent animate-shimmer" />
                      )}
                    </Link>
                  )
                })}
              </div>
            </nav>

            {/* Store info section */}
            <div className="absolute bottom-4 left-4 right-4">
              <div className="backdrop-blur-md bg-slate-100/50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-300/30 dark:border-slate-600/30">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">{store?.storeName?.charAt(0).toUpperCase() || 'S'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{store?.storeName || 'Store'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Admin: {store?.isAdmin ? 'Yes' : 'No'}</p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-3 w-full text-xs text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 lg:max-w-none min-h-screen">
          <main className="p-2 sm:p-4 lg:p-8">
            <div className="animate-fade-in-up">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 lg:hidden transition-all duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Debug button */}
    </div>
  )
}

export default Layout