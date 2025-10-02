'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { useToast } from '@/contexts/ToastContext'
import LoadingOverlay from '@/components/LoadingOverlay'

interface DashboardStats {
  totalProducts: number
  lowStockProducts: number
  todaySales: number
  todayRevenue: number
}

export default function Dashboard() {
  const { success, error } = useToast()
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    lowStockProducts: 0,
    todaySales: 0,
    todayRevenue: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch products count and low stock
        const productsRes = await fetch('/api/products')
        const productsData = await productsRes.json()
        
        const totalProducts = productsData.total || 0
        const lowStockProducts = productsData.products?.filter((p: { quantity: number }) => p.quantity < 10).length || 0

        // Fetch today's sales
        const today = new Date().toISOString().split('T')[0]
        const salesRes = await fetch(`/api/reports/daily?date=${today}`)
        const salesData = await salesRes.json()

        setStats({
          totalProducts,
          lowStockProducts,
          todaySales: salesData.totalSales || 0,
          todayRevenue: salesData.totalRevenue || 0
        })
      } catch (error) {
        console.error('Error fetching dashboard stats:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  const statCards = [
    {
      title: 'Total Products',
      value: stats.totalProducts,
      icon: '📦',
      gradient: 'from-blue-500 to-cyan-500',
      bgGradient: 'from-blue-50/90 to-cyan-50/90 dark:from-blue-900/40 dark:to-cyan-900/40',
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: 'Low Stock Items',
      value: stats.lowStockProducts,
      icon: '⚠️',
      gradient: 'from-amber-500 to-orange-500',
      bgGradient: 'from-amber-50/90 to-orange-50/90 dark:from-amber-900/40 dark:to-orange-900/40',
      change: '-5%',
      changeType: 'negative'
    },
    {
      title: "Today's Sales",
      value: stats.todaySales,
      icon: '💰',
      gradient: 'from-green-500 to-emerald-500',
      bgGradient: 'from-green-50/90 to-emerald-50/90 dark:from-green-900/40 dark:to-emerald-900/40',
      change: '+8%',
      changeType: 'positive'
    },
    {
      title: "Today's Revenue",
      value: `₱${stats.todayRevenue.toFixed(2)}`,
      icon: '📈',
      gradient: 'from-purple-500 to-pink-500',
      bgGradient: 'from-purple-50/90 to-pink-50/90 dark:from-purple-900/40 dark:to-pink-900/40',
      change: '+15%',
      changeType: 'positive'
    }
  ]

  const quickActions = [
    {
      title: 'Add Product',
      description: 'Add new inventory item',
      icon: '➕',
      href: '/products',
      gradient: 'from-indigo-500 to-purple-600',
      bgColor: 'bg-indigo-50 dark:bg-indigo-900/20'
    },
    {
      title: 'New Sale',
      description: 'Start checkout process',
      icon: '🛒',
      href: '/sales',
      gradient: 'from-green-500 to-teal-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20'
    },
    {
      title: 'View Reports',
      description: 'Sales analytics',
      icon: '📊',
      href: '/reports',
      gradient: 'from-pink-500 to-rose-600',
      bgColor: 'bg-pink-50 dark:bg-pink-900/20'
    }
  ]

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center lg:text-left">
            <h1 className="text-4xl lg:text-5xl font-bold gradient-text mb-2">
              Dashboard
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400">
              Welcome to your modern POS system overview
            </p>
          </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat, index) => (
            <div
              key={index}
              className={`
                backdrop-blur-md bg-gradient-to-br ${stat.bgGradient} rounded-2xl p-6 border border-slate-200/50 dark:border-slate-700/50 
                group cursor-pointer safe-transform
                transition-transform duration-300 ease-out hover:scale-105
                animate-fade-in-up
              `}
              style={{ animationDelay: `${index * 150}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`
                  w-12 h-12 rounded-xl bg-gradient-to-r ${stat.gradient} 
                  flex items-center justify-center shadow-lg safe-transform
                  transition-transform duration-300 ease-out group-hover:scale-110
                `}>
                  <span className="text-xl">{stat.icon}</span>
                </div>
                <div className={`
                  px-2 py-1 rounded-full text-xs font-semibold
                  ${stat.changeType === 'positive' 
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }
                `}>
                  {stat.change}
                </div>
              </div>
              
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                  {stat.title}
                </p>
                <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {loading ? (
                    <span className="inline-block w-16 h-6 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
                  ) : (
                    stat.value
                  )}
                </p>
              </div>
              
              {/* Hover effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl pointer-events-none" />
            </div>
          ))}
        </div>


        {/* Quick Actions */}
        <div className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 rounded-2xl p-8 border border-slate-200/50 dark:border-slate-700/50">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center">
            <span className="w-8 h-8 bg-gradient-to-r from-violet-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
              ⚡
            </span>
            Quick Actions
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {quickActions.map((action, index) => (
              <a
                key={index}
                href={action.href}
                className={`
                  group block p-6 rounded-xl ${action.bgColor} border border-white/30 dark:border-slate-600/30
                  safe-transform transition-transform duration-300 ease-out hover:scale-105 hover:shadow-lg
                  animate-fade-in-up
                `}
                style={{ animationDelay: `${(index + 4) * 150}ms` }}
              >
                <div className="flex items-center mb-4">
                  <div className={`
                    w-12 h-12 rounded-xl bg-gradient-to-r ${action.gradient} 
                    flex items-center justify-center shadow-lg safe-transform
                    transition-transform duration-300 ease-out group-hover:scale-110
                  `}>
                    <span className="text-xl">{action.icon}</span>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-1 group-hover:gradient-text transition-all duration-300">
                    {action.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {action.description}
                  </p>
                </div>
                
                {/* Arrow icon */}
                <div className="mt-4 flex justify-end">
                  <div className="w-6 h-6 rounded-full bg-white/50 dark:bg-slate-700/50 flex items-center justify-center group-hover:bg-white dark:group-hover:bg-slate-600 transition-all duration-300">
                    <span className="text-xs">→</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Recent Activity Preview */}
        <div className="backdrop-blur-md bg-white/90 dark:bg-slate-900/90 rounded-2xl p-8 border border-slate-200/50 dark:border-slate-700/50">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6 flex items-center">
            <span className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center mr-3">
              📈
            </span>
            Recent Activity
          </h2>
          
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">📊</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Recent activity will appear here once you start making sales
            </p>
          </div>
        </div>
      </div>
    </Layout>

    {/* Loading Overlay */}
    <LoadingOverlay
      isVisible={loading}
      title="Loading Dashboard"
      message="Fetching store statistics and recent activity..."
      color="blue"
    />
    </ProtectedRoute>
  )
}