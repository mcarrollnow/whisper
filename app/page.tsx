'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSession } from '@/lib/signal-auth'

export default function HomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const user = getSession()
        
        if (user) {
          // User is logged in, redirect to messages
          router.replace('/messages')
        } else {
          // User is not logged in, redirect to auth
          router.replace('/auth')
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        // On error, redirect to auth
        router.replace('/auth')
      } finally {
        setLoading(false)
      }
    }

    checkAuthAndRedirect()
  }, [router])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-bg">
        <div className="text-center">
          <div className="mb-4">
            <img 
              src="/logo.png" 
              alt="Whisper Logo" 
              className="w-16 h-16 mx-auto object-contain opacity-75"
            />
          </div>
          <div className="animate-pulse text-dark-text-secondary">Loading...</div>
        </div>
      </div>
    )
  }

  return null
}
