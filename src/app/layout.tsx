import type { Metadata } from "next"
import { ThemeProvider } from "@/contexts/ThemeContext"
import { ToastProvider } from "@/contexts/ToastContext"
import { AuthProvider } from "@/contexts/AuthContext"
import "./globals.css"

export const metadata: Metadata = {
  title: "BzPOS",
  description: "Bazaar Point of Sale",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
            <html lang="en" suppressHydrationWarning className="dark">
              <body className="antialiased transition-colors duration-300 bg-slate-900 text-slate-100">
                <ThemeProvider>
                  <ToastProvider>
                    <AuthProvider>
                      {children}
                    </AuthProvider>
                  </ToastProvider>
                </ThemeProvider>
              </body>
            </html>
  )
}