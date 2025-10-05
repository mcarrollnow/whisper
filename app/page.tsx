'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to new privacy-focused auth page
    router.push('/auth')
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-dark-bg">
      <div className="animate-pulse text-dark-text-secondary">Redirecting...</div>
    </div>
  )
}
