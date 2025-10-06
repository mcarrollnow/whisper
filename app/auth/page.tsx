'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSignalAccount, loginSignalUser, generateUsername, saveSession } from '@/lib/signal-auth'

export default function PrivateAuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [generatedUsername, setGeneratedUsername] = useState('')
  const router = useRouter()

  const handleGenerateUsername = async () => {
    const newUsername = await generateUsername()
    setGeneratedUsername(newUsername)
    setUsername(newUsername)
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        // Login with username and password
        const result = await loginSignalUser(username, password)
        
        if (result.error) {
          setError(result.error)
        } else if (result.user) {
          await saveSession(result.user)
          router.push('/messages')
        }
      } else {
        // Create account
        if (!password || password.length < 8) {
          setError('Password must be at least 8 characters long')
          return
        }
        
        const result = await createSignalAccount(password, displayName)
        
        if (result.error) {
          setError(result.error)
        } else if (result.user) {
          await saveSession(result.user)
          router.push('/messages')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md">
        {/* Logo/Header - Signal Style */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Whisper Logo"
              className="w-20 h-20 object-contain"
            />
          </div>
          <h1 className="text-3xl font-semibold text-dark-text mb-2">Whisper</h1>
          <p className="text-dark-text-secondary text-base">Anonymous • Private • Secure</p>
        </div>

        {/* Auth Form - Signal Style */}
        <div className="bg-dark-surface rounded-2xl p-8 shadow-2xl">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-3 rounded-xl font-medium text-base transition-all ${
                isLogin
                  ? 'bg-accent-primary text-white'
                  : 'bg-dark-elevated text-dark-text-secondary hover:text-dark-text'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-3 rounded-xl font-medium text-base transition-all ${
                !isLogin
                  ? 'bg-accent-primary text-white'
                  : 'bg-dark-elevated text-dark-text-secondary hover:text-dark-text'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-accent-error/10 border border-accent-error/30 rounded-xl text-accent-error text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-dark-text text-sm font-medium mb-2">
                    Anonymous Username
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="flex-1 px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl text-dark-text text-base placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                      placeholder="@whisper.42"
                      required={!isLogin}
                      readOnly={!!generatedUsername}
                      style={{ fontSize: '16px' }}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateUsername}
                      className="px-4 py-3 bg-accent-primary text-white rounded-xl hover:bg-accent-primary-hover text-sm font-medium transition-colors"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="text-sm text-dark-text-secondary mt-2">
                    Your anonymous username - no personal info required
                  </p>
                </div>

                <div>
                  <label className="block text-dark-text text-sm font-medium mb-2">
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl text-dark-text text-base placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                    placeholder="How others see you (optional)"
                    style={{ fontSize: '16px' }}
                  />
                </div>
              </>
            )}

            {isLogin && (
              <div>
                <label className="block text-dark-text text-sm font-medium mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl text-dark-text text-base placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                  placeholder="@whisper.42"
                  required
                  style={{ fontSize: '16px' }}
                />
              </div>
            )}

            <div>
              <label className="block text-dark-text text-sm font-medium mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-xl text-dark-text text-base placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                placeholder="••••••••"
                required
                minLength={8}
                style={{ fontSize: '16px' }}
              />
              {!isLogin && (
                <p className="text-sm text-dark-text-secondary mt-2">
                  Minimum 8 characters
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-accent-primary text-white rounded-xl font-medium text-base hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6"
            >
              {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-dark-text-secondary border-t border-dark-border pt-6">
            <div className="space-y-2">
              <p><strong className="text-dark-text">Zero Knowledge:</strong> No email, phone, or personal data</p>
              <p><strong className="text-dark-text">Anonymous:</strong> Auto-generated usernames</p>
              <p><strong className="text-dark-text">Encrypted:</strong> End-to-end Signal Protocol</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
