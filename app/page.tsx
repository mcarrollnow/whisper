'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, type Message, type User } from '@/lib/supabase'
import { signalEncryption } from '@/lib/encryption'
import { formatDistanceToNow } from 'date-fns'

type ChatMessage = {
  id: string
  content: string
  sender_id: string
  created_at: string
  isSent: boolean
}

export default function Home() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Authentication and setup
  useEffect(() => {
    initializeUser()
  }, [])

  const initializeUser = async () => {
    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        // Sign in anonymously for demo
        const { data, error } = await supabase.auth.signInAnonymously()
        if (error) throw error
      }

      // Get or create user profile
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No user found')

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (!profile) {
        // Initialize Signal Protocol keys
        const keys = await signalEncryption.initializeUser()

        // Convert keys to base64 for storage
        const identityKeyBase64 = signalEncryption.arrayBufferToBase64(keys.identityKeyPair.pubKey)
        const signedPreKeyBase64 = signalEncryption.arrayBufferToBase64(keys.signedPreKey.publicKey)
        const signatureBase64 = signalEncryption.arrayBufferToBase64(keys.signedPreKey.signature)

        // Create user profile
        const { data: newProfile, error: createError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email || `user-${user.id}@secure.local`,
            username: `User${user.id.slice(0, 8)}`,
            identity_key: identityKeyBase64,
            signed_pre_key: signedPreKeyBase64,
            pre_key_signature: signatureBase64,
          })
          .select()
          .single()

        if (createError) throw createError
        setCurrentUser(newProfile)
      } else {
        setCurrentUser(profile)
      }

      loadMessages()
      subscribeToMessages()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  const loadMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: true })

      if (error) throw error

      const decryptedMessages: ChatMessage[] = await Promise.all(
        (data || []).map(async (msg: Message) => {
          try {
            // Try to decrypt the message
            const encryptedData = JSON.parse(msg.encrypted_content)
            
            // Determine sender (the other party)
            const senderId = msg.sender_id === user.id ? msg.recipient_id : msg.sender_id
            
            const ciphertext = {
              type: encryptedData.type,
              body: encryptedData.body,
            }

            const decryptedContent = await signalEncryption.decryptMessage(
              senderId,
              1,
              ciphertext
            )

            return {
              id: msg.id,
              content: decryptedContent,
              sender_id: msg.sender_id,
              created_at: msg.created_at,
              isSent: msg.sender_id === user.id,
            }
          } catch (decryptError) {
            console.error('Decryption error:', decryptError)
            // If decryption fails, show encrypted content
            return {
              id: msg.id,
              content: '[Encrypted message]',
              sender_id: msg.sender_id,
              created_at: msg.created_at,
              isSent: msg.sender_id === user.id,
            }
          }
        })
      )

      setMessages(decryptedMessages)
    } catch (err: any) {
      console.error('Error loading messages:', err)
    }
  }

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMsg = payload.new as Message
          const { data: { user } } = await supabase.auth.getUser()
          
          try {
            // Decrypt the new message
            const encryptedData = JSON.parse(newMsg.encrypted_content)
            const senderId = newMsg.sender_id === user?.id ? newMsg.recipient_id : newMsg.sender_id
            
            const ciphertext = {
              type: encryptedData.type,
              body: encryptedData.body,
            }

            const decryptedContent = await signalEncryption.decryptMessage(
              senderId,
              1,
              ciphertext
            )

            setMessages((prev) => [
              ...prev,
              {
                id: newMsg.id,
                content: decryptedContent,
                sender_id: newMsg.sender_id,
                created_at: newMsg.created_at,
                isSent: newMsg.sender_id === user?.id,
              },
            ])
          } catch (error) {
            console.error('Failed to decrypt incoming message:', error)
            // Show encrypted message if decryption fails
            setMessages((prev) => [
              ...prev,
              {
                id: newMsg.id,
                content: '[Encrypted message]',
                sender_id: newMsg.sender_id,
                created_at: newMsg.created_at,
                isSent: newMsg.sender_id === user?.id,
              },
            ])
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentUser) return

    try {
      // Find recipient
      const { data: recipient } = await supabase
        .from('users')
        .select('*')
        .eq('email', recipientEmail)
        .single()

      if (!recipient) {
        setError('Recipient not found')
        return
      }

      // Build session with recipient if not already established
      try {
        const preKeyBundle = {
          registrationId: 1, // In production, store this properly
          identityKey: signalEncryption.base64ToArrayBuffer(recipient.identity_key),
          signedPreKey: {
            keyId: 1,
            publicKey: signalEncryption.base64ToArrayBuffer(recipient.signed_pre_key),
            signature: signalEncryption.base64ToArrayBuffer(recipient.pre_key_signature),
          },
        }

        await signalEncryption.buildSession(recipient.id, 1, preKeyBundle)
      } catch (sessionError) {
        // Session might already exist, continue
        console.log('Session may already exist:', sessionError)
      }

      // Encrypt the message using Signal Protocol
      const ciphertext = await signalEncryption.encryptMessage(recipient.id, 1, newMessage)
      
      // Store the encrypted message
      const encryptedContent = JSON.stringify({
        type: ciphertext.type,
        body: ciphertext.body,
      })

      const { error } = await supabase.from('messages').insert({
        sender_id: currentUser.id,
        recipient_id: recipient.id,
        encrypted_content: encryptedContent,
      })

      if (error) throw error

      setNewMessage('')
      setError('')
    } catch (err: any) {
      setError(err.message)
      console.error('Send error:', err)
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-bg">
        <div className="animate-pulse text-dark-text-secondary">Loading...</div>
      </div>
    )
  }

  return (
    <main className="flex flex-col h-screen bg-dark-bg">
      {/* Header */}
      <header className="bg-dark-surface border-b border-dark-border p-4 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-accent-primary to-accent-secondary rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-dark-text">SecureMessenger</h1>
              <p className="text-xs text-dark-text-secondary">End-to-End Encrypted</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="text-sm text-dark-text font-medium">
              {currentUser?.username}
            </div>
            <div className="text-xs text-dark-text-secondary">
              {currentUser?.email}
            </div>
          </div>
        </div>
      </header>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-6 p-4 bg-accent-primary/10 border border-accent-primary/20 rounded-lg">
                <p className="text-dark-text text-sm mb-2">
                  <strong>📧 Your Email:</strong> {currentUser?.email}
                </p>
                <p className="text-dark-text-secondary text-xs">
                  Share this email with someone so they can message you! Open this app in another browser/window to test.
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(currentUser?.email || '')
                    setError('Email copied to clipboard! ✓')
                    setTimeout(() => setError(''), 2000)
                  }}
                  className="mt-3 px-4 py-2 bg-accent-primary text-white text-sm rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Copy My Email
                </button>
              </div>
              <div className="w-20 h-20 bg-dark-elevated rounded-full mx-auto mb-4 flex items-center justify-center">
                <svg className="w-10 h-10 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <p className="text-dark-text-secondary">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.isSent ? 'justify-end' : 'justify-start'} animate-slide-up`}
              >
                <div
                  className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl ${
                    msg.isSent
                      ? 'bg-accent-primary text-white rounded-br-sm'
                      : 'bg-dark-elevated text-dark-text rounded-bl-sm'
                  }`}
                >
                  <p className="break-words">{msg.content}</p>
                  <p className={`text-xs mt-1 ${msg.isSent ? 'text-blue-100' : 'text-dark-text-secondary'}`}>
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-dark-surface border-t border-dark-border p-4">
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-3 p-3 bg-accent-error/10 border border-accent-error/20 rounded-lg text-accent-error text-sm">
              {error}
            </div>
          )}
          
          <div className="mb-3">
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Recipient email..."
              className="w-full px-4 py-2 bg-dark-elevated border border-dark-border rounded-lg text-dark-text placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
            />
          </div>

          <form onSubmit={sendMessage} className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 bg-dark-elevated border border-dark-border rounded-full text-dark-text placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="px-6 py-3 bg-accent-primary text-white rounded-full font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              <span>Send</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
