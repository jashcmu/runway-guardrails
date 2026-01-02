'use client'

import Link from 'next/link'
import { useTheme } from '@/components/theme-provider'
import { useState, useEffect } from 'react'

// Icons as components
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

const ArrowRightIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14"/>
    <path d="m12 5 7 7-7 7"/>
  </svg>
)

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
)

// Feature icons
const ChartIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 3v18h18"/>
    <path d="m19 9-5 5-4-4-3 3"/>
  </svg>
)

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)

const ShieldIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
)

const BankIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="5" rx="2"/>
    <line x1="2" x2="22" y1="10" y2="10"/>
  </svg>
)

const AlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
    <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
  </svg>
)

const CalculatorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="16" height="20" x="4" y="2" rx="2"/>
    <line x1="8" x2="16" y1="6" y2="6"/>
    <line x1="16" x2="16" y1="14" y2="18"/>
    <path d="M16 10h.01"/>
    <path d="M12 10h.01"/>
    <path d="M8 10h.01"/>
    <path d="M12 14h.01"/>
    <path d="M8 14h.01"/>
    <path d="M12 18h.01"/>
    <path d="M8 18h.01"/>
  </svg>
)

export default function LandingPage() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }

  const features = [
    {
      icon: <ChartIcon />,
      title: 'Real-time Analytics',
      description: 'Track your burn rate, revenue, and expenses with live data synced from your bank accounts.'
    },
    {
      icon: <ClockIcon />,
      title: 'Runway Forecasting',
      description: 'Know exactly how many months of runway you have left with intelligent cash flow predictions.'
    },
    {
      icon: <ShieldIcon />,
      title: 'Smart Alerts',
      description: 'Get notified before problems arise with customizable threshold alerts and trend warnings.'
    },
    {
      icon: <BankIcon />,
      title: 'Bank Integration',
      description: 'Import transactions directly from your bank statements with automatic categorization.'
    },
    {
      icon: <AlertIcon />,
      title: 'AR/AP Tracking',
      description: 'Monitor accounts receivable and payable to maintain healthy cash flow and working capital.'
    },
    {
      icon: <CalculatorIcon />,
      title: 'Fundraising Planning',
      description: 'Plan your next raise with scenario modeling and dilution calculators.'
    }
  ]

  const stats = [
    { value: '₹100Cr+', label: 'Tracked' },
    { value: '500+', label: 'Companies' },
    { value: '99.9%', label: 'Uptime' },
    { value: '24/7', label: 'Support' }
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)' }}>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--foreground)' }}>
                <span style={{ color: 'var(--background)', fontWeight: 700, fontSize: '14px' }}>R</span>
              </div>
              <span className="font-semibold text-lg" style={{ color: 'var(--foreground)' }}>
                Runway
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-8">
              <Link href="#features" className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: 'var(--foreground-secondary)' }}>
                Features
              </Link>
              <Link href="#how-it-works" className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: 'var(--foreground-secondary)' }}>
                How it works
              </Link>
              <Link href="#pricing" className="text-sm font-medium hover:opacity-70 transition-opacity" style={{ color: 'var(--foreground-secondary)' }}>
                Pricing
              </Link>
            </div>

            <div className="flex items-center gap-3">
              {mounted && (
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-lg hover:opacity-70 transition-opacity"
                  style={{ color: 'var(--foreground-secondary)' }}
                  aria-label="Toggle theme"
                >
                  {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
                </button>
              )}
              <Link
                href="/login"
                className="text-sm font-medium px-4 py-2 rounded-lg transition-all hover:opacity-80"
                style={{ color: 'var(--foreground)' }}
              >
                Sign in
              </Link>
              <Link
                href="/login"
                className="text-sm font-medium px-4 py-2 rounded-lg transition-all hover:opacity-90"
                style={{ 
                  background: 'var(--foreground)', 
                  color: 'var(--background)' 
                }}
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 hero-gradient overflow-hidden">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-8 animate-fade-in"
              style={{ 
                background: 'var(--muted)', 
                color: 'var(--foreground-secondary)',
                border: '1px solid var(--border)'
              }}
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Now with Razorpay integration
            </div>

            {/* Main headline */}
            <h1 
              className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 animate-slide-up text-balance"
              style={{ color: 'var(--foreground)' }}
            >
              Financial intelligence for{' '}
              <span className="gradient-text">startups</span>
            </h1>

            {/* Subheadline */}
            <p 
              className="text-lg md:text-xl mb-10 max-w-2xl mx-auto animate-slide-up delay-100 text-balance"
              style={{ color: 'var(--foreground-secondary)' }}
            >
              Track your burn rate, extend your runway, and make data-driven decisions that secure your startup's future. All in one powerful dashboard.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up delay-200">
              <Link
                href="/login"
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-base font-medium transition-all hover:opacity-90 hover:gap-3"
                style={{ 
                  background: 'var(--foreground)', 
                  color: 'var(--background)' 
                }}
              >
                Start for free
                <ArrowRightIcon />
              </Link>
              <Link
                href="#features"
                className="flex items-center gap-2 px-6 py-3 rounded-lg text-base font-medium transition-all"
                style={{ 
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)'
                }}
              >
                See how it works
              </Link>
            </div>

            {/* Social proof */}
            <p 
              className="mt-8 text-sm animate-fade-in delay-300"
              style={{ color: 'var(--foreground-tertiary)' }}
            >
              Trusted by 500+ startups across India
            </p>
          </div>

          {/* Dashboard Preview */}
          <div className="relative mt-16 animate-slide-up delay-400">
            <div 
              className="relative mx-auto max-w-5xl rounded-2xl overflow-hidden shadow-2xl"
              style={{ 
                background: 'var(--card)',
                border: '1px solid var(--border)'
              }}
            >
              {/* Browser Chrome */}
              <div 
                className="flex items-center gap-2 px-4 py-3"
                style={{ 
                  background: 'var(--muted)',
                  borderBottom: '1px solid var(--border)'
                }}
              >
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div 
                  className="flex-1 mx-4 px-4 py-1 rounded-md text-xs text-center"
                  style={{ 
                    background: 'var(--background)',
                    color: 'var(--foreground-tertiary)'
                  }}
                >
                  app.runwayguardrails.com/dashboard
                </div>
              </div>

              {/* Dashboard Content */}
              <div className="p-8">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  {/* Cash Balance Card */}
                  <div 
                    className="p-6 rounded-xl"
                    style={{ 
                      background: 'var(--muted)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <p className="text-sm mb-2" style={{ color: 'var(--foreground-tertiary)' }}>Cash Balance</p>
                    <p className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>₹87.4L</p>
                    <p className="text-sm mt-2 text-green-500">↑ 12.5% this month</p>
                  </div>

                  {/* Burn Rate Card */}
                  <div 
                    className="p-6 rounded-xl"
                    style={{ 
                      background: 'var(--muted)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <p className="text-sm mb-2" style={{ color: 'var(--foreground-tertiary)' }}>Net Burn Rate</p>
                    <p className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>₹12.5L</p>
                    <p className="text-sm mt-2" style={{ color: 'var(--foreground-tertiary)' }}>per month</p>
                  </div>

                  {/* Runway Card */}
                  <div 
                    className="p-6 rounded-xl"
                    style={{ 
                      background: 'var(--muted)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <p className="text-sm mb-2" style={{ color: 'var(--foreground-tertiary)' }}>Runway</p>
                    <p className="text-3xl font-semibold" style={{ color: 'var(--foreground)' }}>7 months</p>
                    <p className="text-sm mt-2 text-amber-500">Action needed</p>
                  </div>
                </div>

                {/* Chart placeholder */}
                <div 
                  className="h-48 rounded-xl flex items-center justify-center"
                  style={{ 
                    background: 'var(--muted)',
                    border: '1px solid var(--border)'
                  }}
                >
                  <div className="flex items-end gap-2 h-32">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 75, 95, 80].map((height, i) => (
                      <div
                        key={i}
                        className="w-6 rounded-t-md transition-all hover:opacity-80"
                        style={{ 
                          height: `${height}%`,
                          background: i >= 10 ? 'var(--foreground)' : 'var(--border)'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Decorative gradient */}
            <div 
              className="absolute -z-10 inset-0 blur-3xl opacity-30"
              style={{
                background: 'radial-gradient(circle at 50% 50%, rgba(99, 102, 241, 0.3), transparent 70%)'
              }}
            />
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6" style={{ borderTop: '1px solid var(--border)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl md:text-5xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                  {stat.value}
                </p>
                <p className="text-sm" style={{ color: 'var(--foreground-tertiary)' }}>
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6" style={{ background: 'var(--background-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Everything you need
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--foreground-secondary)' }}>
              From automated bank imports to intelligent forecasting, we've got your financial operations covered.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <div
                key={i}
                className="p-8 rounded-2xl hover-lift cursor-default"
                style={{ 
                  background: 'var(--card)',
                  border: '1px solid var(--border)'
                }}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-6"
                  style={{ 
                    background: 'var(--muted)',
                    color: 'var(--foreground)'
                  }}
                >
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
                  {feature.title}
                </h3>
                <p style={{ color: 'var(--foreground-secondary)' }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Get started in minutes
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--foreground-secondary)' }}>
              Three simple steps to transform your financial management.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Connect your accounts',
                description: 'Sign up with Google and upload your bank statements. We support all major Indian banks.'
              },
              {
                step: '02',
                title: 'Get instant insights',
                description: 'Our AI automatically categorizes transactions and calculates your burn rate and runway.'
              },
              {
                step: '03',
                title: 'Make better decisions',
                description: 'Use forecasts and alerts to plan ahead and extend your runway when it matters most.'
              }
            ].map((item, i) => (
              <div key={i} className="relative">
                <div 
                  className="text-6xl font-bold mb-6 opacity-10"
                  style={{ color: 'var(--foreground)' }}
                >
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--foreground)' }}>
                  {item.title}
                </h3>
                <p style={{ color: 'var(--foreground-secondary)' }}>
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6" style={{ background: 'var(--background-secondary)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
              Simple, transparent pricing
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--foreground-secondary)' }}>
              Start free, upgrade when you're ready.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div 
              className="p-8 rounded-2xl"
              style={{ 
                background: 'var(--card)',
                border: '1px solid var(--border)'
              }}
            >
              <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                Starter
              </h3>
              <p className="mb-6" style={{ color: 'var(--foreground-secondary)' }}>
                Perfect for early-stage startups
              </p>
              <div className="mb-6">
                <span className="text-4xl font-semibold" style={{ color: 'var(--foreground)' }}>Free</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['1 company', 'Basic analytics', 'Manual imports', 'Email support'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3" style={{ color: 'var(--foreground-secondary)' }}>
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full text-center py-3 rounded-lg font-medium transition-all"
                style={{ 
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)'
                }}
              >
                Get started free
              </Link>
            </div>

            {/* Pro Plan */}
            <div 
              className="p-8 rounded-2xl relative"
              style={{ 
                background: 'var(--foreground)',
                color: 'var(--background)'
              }}
            >
              <div 
                className="absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium"
                style={{ background: 'rgba(255,255,255,0.2)' }}
              >
                Popular
              </div>
              <h3 className="text-xl font-semibold mb-2">
                Pro
              </h3>
              <p className="mb-6 opacity-70">
                For growing startups that need more
              </p>
              <div className="mb-6">
                <span className="text-4xl font-semibold">₹2,999</span>
                <span className="opacity-70">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                {['Unlimited companies', 'Advanced analytics', 'Bank integrations', 'Razorpay payments', 'Priority support', 'API access'].map((item, i) => (
                  <li key={i} className="flex items-center gap-3 opacity-90">
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="block w-full text-center py-3 rounded-lg font-medium transition-all"
                style={{ 
                  background: 'var(--background)',
                  color: 'var(--foreground)'
                }}
              >
                Start 14-day trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
            Ready to take control of your finances?
          </h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto" style={{ color: 'var(--foreground-secondary)' }}>
            Join 500+ startups already using Runway Guardrails to manage their burn rate and extend their runway.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg text-lg font-medium transition-all hover:opacity-90 hover:gap-3"
            style={{ 
              background: 'var(--foreground)', 
              color: 'var(--background)' 
            }}
          >
            Get started for free
            <ArrowRightIcon />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer 
        className="py-12 px-6"
        style={{ 
          background: 'var(--background-secondary)',
          borderTop: '1px solid var(--border)'
        }}
      >
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--foreground)' }}>
                  <span style={{ color: 'var(--background)', fontWeight: 700, fontSize: '14px' }}>R</span>
                </div>
                <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Runway</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--foreground-tertiary)' }}>
                Financial intelligence for startups.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Product</h4>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                <li><Link href="#features" className="hover:opacity-70">Features</Link></li>
                <li><Link href="#pricing" className="hover:opacity-70">Pricing</Link></li>
                <li><Link href="#" className="hover:opacity-70">Integrations</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Company</h4>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                <li><Link href="#" className="hover:opacity-70">About</Link></li>
                <li><Link href="#" className="hover:opacity-70">Blog</Link></li>
                <li><Link href="#" className="hover:opacity-70">Careers</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4" style={{ color: 'var(--foreground)' }}>Legal</h4>
              <ul className="space-y-2 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                <li><Link href="#" className="hover:opacity-70">Privacy</Link></li>
                <li><Link href="#" className="hover:opacity-70">Terms</Link></li>
                <li><Link href="#" className="hover:opacity-70">Security</Link></li>
              </ul>
            </div>
          </div>
          <div 
            className="pt-8 text-sm text-center"
            style={{ 
              borderTop: '1px solid var(--border)',
              color: 'var(--foreground-tertiary)'
            }}
          >
            © 2026 Runway Guardrails. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
