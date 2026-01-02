'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'welcome' | 'company' | 'cash' | 'bank' | 'budgets' | 'complete'

export default function OnboardingWizard() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [companyName, setCompanyName] = useState('')
  const [cashBalance, setCashBalance] = useState('')
  const [runwayGoal, setRunwayGoal] = useState('12')
  const [loading, setLoading] = useState(false)
  const [companyId, setCompanyId] = useState('')

  const handleCreateCompany = async () => {
    if (!companyName) {
      alert('Please enter company name')
      return
    }

    setLoading(true)
    try {
      // Create company - we'll update cash balance later
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: companyName,
          cashBalance: 0, // Initialize with 0, will update in next step
          targetMonths: 12
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCompanyId(data.company.id)
        setStep('cash')
      } else {
        alert('Failed to create company')
      }
    } catch (error) {
      alert('Error creating company')
    } finally {
      setLoading(false)
    }
  }

  const handleBankUpload = async (file: File) => {
    if (!companyId) return

    const formData = new FormData()
    formData.append('file', file)
    formData.append('companyId', companyId)

    try {
      const response = await fetch('/api/banks', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        alert('Bank statement imported successfully!')
      } else {
        alert('Failed to import bank statement')
      }
    } catch (error) {
      alert('Error importing bank statement')
    }
  }

  const handleComplete = async () => {
    // Cash balance already saved in previous step
    // Just navigate to dashboard
    if (companyId) {
      router.push('/dashboard')
    } else {
      alert('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--background)' }}>
      <div 
        className="rounded-2xl max-w-2xl w-full p-8"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div 
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--foreground)' }}
              >
                <span style={{ color: 'var(--background)', fontWeight: 700, fontSize: '14px' }}>R</span>
              </div>
              <h1 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>Setup</h1>
            </div>
            <div className="text-sm" style={{ color: 'var(--foreground-tertiary)' }}>
              Step {step === 'welcome' ? 1 : step === 'company' ? 2 : step === 'cash' ? 3 : step === 'bank' ? 4 : step === 'budgets' ? 5 : 6} of 6
            </div>
          </div>
          <div className="w-full rounded-full h-1" style={{ background: 'var(--border)' }}>
            <div
              className="h-1 rounded-full transition-all"
              style={{
                width: `${(step === 'welcome' ? 1 : step === 'company' ? 2 : step === 'cash' ? 3 : step === 'bank' ? 4 : step === 'budgets' ? 5 : 6) * (100 / 6)}%`,
                background: 'var(--foreground)'
              }}
            />
          </div>
        </div>

        {step === 'welcome' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Let's Get Started!</h2>
              <p style={{ color: 'var(--foreground-secondary)' }}>
                We'll help you set up your financial dashboard in just a few steps. This will take about 5 minutes.
              </p>
            </div>
            <div 
              className="p-4 rounded-xl"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}
            >
              <h3 className="font-medium mb-3" style={{ color: 'var(--foreground)' }}>What you'll need:</h3>
              <ul className="space-y-2">
                {['Your company name', 'Current cash balance', 'Bank statement (CSV) - optional'].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm" style={{ color: 'var(--foreground-secondary)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <button
              onClick={() => setStep('company')}
              className="w-full px-4 py-3 rounded-xl font-medium transition-all hover:opacity-90"
              style={{ background: 'var(--foreground)', color: 'var(--background)' }}
            >
              Get Started
            </button>
          </div>
        )}

        {step === 'company' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>Company Information</h2>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all"
                style={{ 
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)'
                }}
                placeholder="Enter your company name"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Back
              </button>
              <button
                onClick={handleCreateCompany}
                disabled={loading || !companyName}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}
              >
                {loading ? 'Creating...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 'cash' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold" style={{ color: 'var(--foreground)' }}>Financial Setup</h2>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Current Cash Balance (₹)</label>
              <input
                type="number"
                value={cashBalance}
                onChange={(e) => setCashBalance(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all"
                style={{ 
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)'
                }}
                placeholder="Enter your current cash balance"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>Target Runway (months)</label>
              <select
                value={runwayGoal}
                onChange={(e) => setRunwayGoal(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all"
                style={{ 
                  background: 'var(--muted)',
                  border: '1px solid var(--border)',
                  color: 'var(--foreground)'
                }}
              >
                <option value="6">6 months</option>
                <option value="12">12 months</option>
                <option value="18">18 months</option>
                <option value="24">24 months</option>
              </select>
              <p className="text-xs mt-2" style={{ color: 'var(--foreground-tertiary)' }}>This helps us set appropriate budget alerts</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('company')}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Back
              </button>
              <button
                onClick={async () => {
                  // Save cash balance immediately
                  if (!companyId || !cashBalance) {
                    alert('Please enter a cash balance');
                    return;
                  }
                  
                  setLoading(true);
                  try {
                    console.log('💾 Saving cash balance:', cashBalance);
                    const response = await fetch('/api/companies', {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        companyId,
                        cashBalance: parseFloat(cashBalance),
                        targetMonths: parseInt(runwayGoal)
                      }),
                    });

                    if (response.ok) {
                      const data = await response.json();
                      console.log('✅ Cash balance saved successfully:', data);
                      alert(`✅ Cash balance saved: ₹${parseFloat(cashBalance).toLocaleString()}`);
                      setStep('bank');
                    } else {
                      const errorData = await response.json();
                      console.error('❌ Failed to save:', errorData);
                      alert('Failed to save cash balance. Please try again.');
                    }
                  } catch (error) {
                    console.error('❌ Error saving cash balance:', error);
                    alert('Error saving financial data. Please try again.');
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={!cashBalance || loading}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        )}

        {step === 'bank' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Import Bank Statements</h2>
              <p style={{ color: 'var(--foreground-secondary)' }}>
                Upload a CSV bank statement to automatically import your transactions. You can skip this and add transactions manually later.
              </p>
            </div>
            <div 
              className="rounded-xl p-8 text-center"
              style={{ border: '2px dashed var(--border)', background: 'var(--muted)' }}
            >
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleBankUpload(file)
                }}
                className="hidden"
                id="bank-upload"
              />
              <label
                htmlFor="bank-upload"
                className="cursor-pointer font-medium"
                style={{ color: 'var(--foreground)' }}
              >
                Click to upload CSV file
              </label>
              <p className="text-xs mt-2" style={{ color: 'var(--foreground-tertiary)' }}>Supports HDFC, ICICI, SBI and other Indian banks</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('cash')}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Back
              </button>
              <button
                onClick={() => setStep('budgets')}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}
              >
                {companyId ? 'Continue' : 'Skip'}
              </button>
            </div>
          </div>
        )}

        {step === 'budgets' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>Set Up Budgets</h2>
              <p style={{ color: 'var(--foreground-secondary)' }}>
                We can suggest budgets based on your historical spending, or you can set them up manually later.
              </p>
            </div>
            {companyId && (
              <button
                onClick={async () => {
                  try {
                    const response = await fetch(`/api/budgets/suggestions?companyId=${companyId}`)
                    if (response.ok) {
                      const data = await response.json()
                      alert(`We found ${data.suggestions.length} budget suggestions! You can review and accept them in the dashboard.`)
                    }
                  } catch (error) {
                    console.error('Failed to get suggestions:', error)
                  }
                }}
                className="w-full px-4 py-3 rounded-xl font-medium transition-all"
                style={{ background: 'rgb(34, 197, 94)', color: 'white' }}
              >
                Get Smart Budget Suggestions
              </button>
            )}
            <p className="text-sm text-center" style={{ color: 'var(--foreground-tertiary)' }}>You can always set up budgets later in the dashboard</p>
            <div className="flex gap-3">
              <button
                onClick={() => setStep('bank')}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                style={{ border: '1px solid var(--border)', color: 'var(--foreground)' }}
              >
                Back
              </button>
              <button
                onClick={() => setStep('complete')}
                className="flex-1 px-4 py-3 rounded-xl font-medium transition-all"
                style={{ background: 'var(--foreground)', color: 'var(--background)' }}
              >
                Complete Setup
              </button>
            </div>
          </div>
        )}

        {step === 'complete' && (
          <div className="space-y-6 text-center py-8">
            <div 
              className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
              style={{ background: 'rgba(34, 197, 94, 0.1)' }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgb(34, 197, 94)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-semibold mb-2" style={{ color: 'var(--foreground)' }}>You're All Set!</h2>
              <p style={{ color: 'var(--foreground-secondary)' }}>
                Your dashboard is ready. Start tracking your runway and managing your finances.
              </p>
            </div>
            <button
              onClick={handleComplete}
              className="w-full px-4 py-3 rounded-xl font-medium transition-all hover:opacity-90"
              style={{ background: 'var(--foreground)', color: 'var(--background)' }}
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

