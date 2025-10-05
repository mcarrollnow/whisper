'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/')
      return
    }

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profile) {
      setUsername(profile.username)
      setEmail(profile.email)
    }
  }

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      await supabase
        .from('users')
        .update({ username })
        .eq('id', user.id)

      setMessage('✓ Profile updated successfully!')
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      })

      if (error) throw error

      setMessage('✓ Password updated successfully!')
      setNewPassword('')
    } catch (error: any) {
      setMessage(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-bg p-8">
      <div className="max-w-2xl mx-auto">
        <button
          onClick={() => router.push('/messages')}
          className="mb-6 flex items-center gap-2 text-dark-text-secondary hover:text-dark-text"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Messages
        </button>

        <h1 className="text-3xl font-bold text-dark-text mb-8">Settings</h1>

        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.startsWith('✓') 
              ? 'bg-accent-success/10 text-accent-success' 
              : 'bg-accent-error/10 text-accent-error'
          }`}>
            {message}
          </div>
        )}

        {/* Profile Settings */}
        <div className="bg-dark-surface rounded-2xl p-6 mb-6 border border-dark-border">
          <h2 className="text-xl font-semibold text-dark-text mb-4">Profile</h2>
          <form onSubmit={updateProfile} className="space-y-4">
            <div>
              <label className="block text-dark-text text-sm font-medium mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text"
                required
              />
            </div>

            <div>
              <label className="block text-dark-text text-sm font-medium mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text-secondary"
                disabled
              />
              <p className="text-xs text-dark-text-secondary mt-1">Email cannot be changed</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </form>
        </div>

        {/* Password Settings */}
        <div className="bg-dark-surface rounded-2xl p-6 border border-dark-border">
          <h2 className="text-xl font-semibold text-dark-text mb-4">Change Password</h2>
          <form onSubmit={updatePassword} className="space-y-4">
            <div>
              <label className="block text-dark-text text-sm font-medium mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text"
                placeholder="Enter new password"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-accent-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
