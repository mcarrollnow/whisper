'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAccount, loginWithUsername, generateUsername, saveSession } from '@/lib/auth'

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
        const result = await loginWithUsername(username, password)
        
        if (result.error) {
          setError(result.error)
        } else if (result.user) {
          saveSession(result.user)
          router.push('/messages')
        }
      } else {
        // Create account
        if (!password || password.length < 8) {
          setError('Password must be at least 8 characters long')
          return
        }
        
        const result = await createAccount(password, displayName)
        
        if (result.error) {
          setError(result.error)
        } else if (result.user) {
          saveSession(result.user)
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
    <div className="h-screen bg-dark-bg flex items-center justify-center p-4 overflow-hidden">
      <div className="w-full max-w-md max-h-full overflow-y-auto">
        {/* Logo/Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 flex items-center justify-center">
            <img 
              src="/logo.png" 
              alt="Whisper Logo" 
              className="w-16 h-16 object-contain"
            />
          </div>
          <h1 className="text-2xl font-bold text-dark-text mb-2">Whisper</h1>
          <p className="text-dark-text-secondary text-sm">Anonymous • Private • Secure</p>
        </div>

        {/* Auth Form */}
        <div className="bg-dark-surface rounded-2xl p-6 border border-dark-border shadow-2xl">
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                isLogin
                  ? 'bg-accent-primary text-white'
                  : 'bg-dark-elevated text-dark-text-secondary hover:text-dark-text'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg font-medium text-sm transition-colors ${
                !isLogin
                  ? 'bg-accent-primary text-white'
                  : 'bg-dark-elevated text-dark-text-secondary hover:text-dark-text'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-accent-error/10 border border-accent-error/20 rounded-lg text-accent-error text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-3">
            {!isLogin && (
              <>
                <div>
                  <label className="block text-dark-text text-xs font-medium mb-1">
                    Anonymous Username
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="flex-1 px-3 py-2 bg-dark-elevated border border-dark-border rounded-lg text-dark-text text-sm placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                      placeholder="@whisper.42"
                      required={!isLogin}
                      readOnly={!!generatedUsername}
                    />
                    <button
                      type="button"
                      onClick={handleGenerateUsername}
                      className="px-3 py-2 bg-accent-primary text-white rounded-lg hover:bg-blue-600 text-xs font-medium"
                    >
                      Generate
                    </button>
                  </div>
                  <p className="text-xs text-dark-text-secondary mt-1">
                    Your anonymous username - no personal info required
                  </p>
                </div>

                <div>
                  <label className="block text-dark-text text-xs font-medium mb-1">
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full px-3 py-2 bg-dark-elevated border border-dark-border rounded-lg text-dark-text text-sm placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                    placeholder="How others see you (optional)"
                  />
                </div>
              </>
            )}

            {isLogin && (
              <div>
                <label className="block text-dark-text text-xs font-medium mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-elevated border border-dark-border rounded-lg text-dark-text text-sm placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                  placeholder="@whisper.42"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-dark-text text-xs font-medium mb-1">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-dark-elevated border border-dark-border rounded-lg text-dark-text text-sm placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                placeholder="••••••••"
                required
                minLength={8}
              />
              {!isLogin && (
                <p className="text-xs text-dark-text-secondary mt-1">
                  Minimum 8 characters
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2 bg-accent-primary text-white rounded-lg font-medium text-sm hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Please wait...' : isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>

          <div className="mt-4 text-center text-xs text-dark-text-secondary">
            <div className="space-y-1">
              <p>🔒 <strong>Zero Knowledge:</strong> No email, phone, or personal data</p>
              <p>👤 <strong>Anonymous:</strong> Auto-generated usernames</p>
              <p>🔐 <strong>Encrypted:</strong> End-to-end Signal Protocol</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
