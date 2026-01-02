'use client'

import { signIn } from 'next-auth/react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4"/>
    <path d="M12 2v2"/>
    <path d="M12 20v2"/>
    <path d="m4.93 4.93 1.41 1.41"/>
    <path d="m17.66 17.66 1.41 1.41"/>
    <path d="M2 12h2"/>
    <path d="M20 12h2"/>
    <path d="m6.34 17.66-1.41 1.41"/>
    <path d="m19.07 4.93-1.41 1.41"/>
  </svg>
)

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
  </svg>
)

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    try {
      await signIn('google', { callbackUrl: '/dashboard' })
    } catch (error) {
      console.error('Sign in error:', error)
      setIsLoading(false)
    }
  }

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  return (
    <div 
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--background)' }}
    >
      {/* Header */}
      <header className="p-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div 
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--foreground)' }}
          >
            <span style={{ color: 'var(--background)', fontWeight: 700, fontSize: '14px' }}>R</span>
          </div>
          <span className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
            Runway
          </span>
        </Link>

        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg transition-opacity hover:opacity-70"
            style={{ color: 'var(--foreground-secondary)' }}
            aria-label="Toggle theme"
          >
            {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Welcome text */}
          <div className="text-center mb-10">
            <h1 
              className="text-3xl font-semibold mb-3"
              style={{ color: 'var(--foreground)' }}
            >
              Welcome back
            </h1>
            <p style={{ color: 'var(--foreground-secondary)' }}>
              Sign in to access your dashboard
            </p>
          </div>

          {/* Sign in card */}
          <div 
            className="rounded-2xl p-8"
            style={{ 
              background: 'var(--card)',
              border: '1px solid var(--border)'
            }}
          >
            {/* Google Sign In Button */}
            <button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 font-medium transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ 
                background: 'var(--foreground)',
                color: 'var(--background)'
              }}
            >
              {isLoading ? (
                <div 
                  className="animate-spin rounded-full h-5 w-5 border-2"
                  style={{ 
                    borderColor: 'var(--background)',
                    borderTopColor: 'transparent'
                  }}
                />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
              <span className="text-xs" style={{ color: 'var(--foreground-tertiary)' }}>or</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
            </div>

            {/* Email input (disabled, for show) */}
            <div className="space-y-4">
              <div>
                <label 
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--foreground)' }}
                >
                  Email
                </label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  disabled
                  className="w-full px-4 py-3 rounded-xl text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    background: 'var(--muted)',
                    border: '1px solid var(--border)',
                    color: 'var(--foreground)'
                  }}
                />
              </div>
              <button
                disabled
                className="w-full rounded-xl px-6 py-3 font-medium transition-all opacity-50 cursor-not-allowed"
                style={{ 
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)'
                }}
              >
                Continue with email
              </button>
            </div>
          </div>

          {/* Footer text */}
          <p 
            className="text-center text-sm mt-8"
            style={{ color: 'var(--foreground-tertiary)' }}
          >
            Don't have an account?{' '}
            <button 
              onClick={handleGoogleSignIn}
              className="font-medium underline underline-offset-4 hover:opacity-70"
              style={{ color: 'var(--foreground)' }}
            >
              Sign up
            </button>
          </p>

          {/* Terms */}
          <p 
            className="text-center text-xs mt-4"
            style={{ color: 'var(--foreground-tertiary)' }}
          >
            By continuing, you agree to our{' '}
            <Link href="#" className="underline underline-offset-2 hover:opacity-70">Terms</Link>
            {' '}and{' '}
            <Link href="#" className="underline underline-offset-2 hover:opacity-70">Privacy Policy</Link>
          </p>
        </div>
      </main>
    </div>
  )
}
