'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isLogin) {
        // Login
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) throw error
        router.push('/messages')
      } else {
        // Sign up
        if (!username.trim()) {
          throw new Error('Username is required')
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) throw error

        if (data.user) {
          // Create user profile
          const { error: profileError } = await supabase
            .from('users')
            .insert({
              id: data.user.id,
              email,
              username,
              identity_key: '',
              signed_pre_key: '',
              pre_key_signature: '',
            })

          if (profileError) throw profileError
          router.push('/messages')
        }
      }
    } catch (err: any) {
      setError(err.message)
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
          <p className="text-dark-text-secondary text-sm">End-to-end encrypted messaging</p>
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
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-3 p-2 bg-accent-error/10 border border-accent-error/20 rounded-lg text-accent-error text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-3">
            {!isLogin && (
              <div>
                <label className="block text-dark-text text-xs font-medium mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3 py-2 bg-dark-elevated border border-dark-border rounded-lg text-dark-text text-sm placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                  placeholder="Choose a username"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-dark-text text-xs font-medium mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 bg-dark-elevated border border-dark-border rounded-lg text-dark-text text-sm placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
                placeholder="your@email.com"
                required
              />
            </div>

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
                minLength={6}
              />
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
            <p>🔒 Your messages are end-to-end encrypted</p>
            <p className="mt-1">Signal Protocol • AES-256</p>
          </div>
        </div>
      </div>
    </div>
  )
}
