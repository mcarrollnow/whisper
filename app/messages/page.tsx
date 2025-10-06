'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { getSession, clearSession } from '@/lib/signal-auth'
import { createSession, getSession as getSignalSession, updateSession, encryptMessage, decryptMessage } from '@/lib/signal-session'
import { getUserContacts, generateInviteCode, getCurrentInviteCode, useInviteCode, areUsersContacts } from '@/lib/secure-contacts'

type User = {
  id: string
  username: string
  display_name?: string
  identity_key_public: string
  registration_id: number
}

type Conversation = {
  id: string
  other_user: User
  last_message: string
}

type Message = {
  id: string
  sender_id: string
  content: string
  created_at: string
}

export default function MessagesPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [currentInviteCode, setCurrentInviteCode] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showAddContactModal, setShowAddContactModal] = useState(false)
  const [addContactCode, setAddContactCode] = useState('')
  const [contacts, setContacts] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    // Force reset zoom on mount and viewport changes
    const resetZoom = () => {
      if (typeof window !== 'undefined') {
        const viewport = document.querySelector('meta[name=viewport]')
        if (viewport) {
          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover')
        }
        window.scrollTo(0, 0)
      }
    }

    resetZoom()
    window.addEventListener('resize', resetZoom)
    window.addEventListener('orientationchange', resetZoom)

    return () => {
      window.removeEventListener('resize', resetZoom)
      window.removeEventListener('orientationchange', resetZoom)
    }
  }, [])

  useEffect(() => {
    if (selectedConversation && currentUser) {
      loadMessages(selectedConversation)
      const cleanup = setupRealtimeSubscription()
      return cleanup
    }
  }, [selectedConversation, currentUser])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers])

  const setupRealtimeSubscription = () => {
    if (!selectedConversation || !currentUser) return () => {}

    console.log('🔔 Setting up realtime subscription for conversation:', selectedConversation)
    console.log('🔔 Current user:', currentUser.id)

    // Subscribe to ALL messages - filter in callback
    const messageChannel = supabase
      .channel(`messages-${selectedConversation}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        async (payload) => {
          console.log('📨 Received new message:', payload)

          // Filter messages for this conversation
          const msg = payload.new
          const isRelevant =
            (msg.sender_id === currentUser.id && msg.recipient_id === selectedConversation) ||
            (msg.sender_id === selectedConversation && msg.recipient_id === currentUser.id)

          if (!isRelevant) {
            console.log('⏭️ Message not for this conversation, skipping')
            return
          }

          // Skip messages sent by current user (already added to local state)
          if (msg.sender_id === currentUser.id) {
            console.log('⏭️ Skipping own message (already in local state)')
            return
          }

          console.log('✅ Message is for this conversation!')
          let content = payload.new.ciphertext || ''

          // Try to decrypt with shared chain key
          if (payload.new.mac && payload.new.mac !== 'no_encryption') {
            try {
              const session = await getSignalSession(currentUser.id, selectedConversation!)
              if (session && session.chain_key_recv) {
                const decrypted = decryptMessage(payload.new.ciphertext, payload.new.mac, session.chain_key_recv)
                if (decrypted) {
                  content = decrypted.message
                  console.log('✅ Successfully decrypted message:', content)
                } else {
                  console.error('❌ Decryption returned null')
                }
              } else {
                console.log('⚠️ No session or chain key found')
              }
            } catch (error) {
              console.error('❌ Decryption failed:', error)
            }
          } else {
            console.log('ℹ️ Message not encrypted')
          }

          const newMessage = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            content,
            created_at: payload.new.created_at,
          }
          console.log('➕ Adding message to state:', newMessage)
          console.log('📊 Current messages count:', messages.length)
          setMessages(prev => {
            console.log('📊 Previous messages:', prev.length)
            const updated = [...prev, newMessage]
            console.log('📊 Updated messages:', updated.length)
            return updated
          })
        }
      )
      .subscribe((status) => {
        console.log('Message channel subscription status:', status)
      })

    // Subscribe to typing indicators
    const typingChannel = supabase
      .channel(`typing-${selectedConversation}`)
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { user_id, is_typing } = payload.payload
        if (user_id !== currentUser.id) {
          setTypingUsers(prev => {
            const newSet = new Set(prev)
            if (is_typing) {
              newSet.add(user_id)
            } else {
              newSet.delete(user_id)
            }
            return newSet
          })
        }
      })
      .subscribe((status) => {
        console.log('Typing channel subscription status:', status)
      })

    // Return cleanup function
    return () => {
      console.log('Cleaning up realtime subscriptions')
      messageChannel.unsubscribe()
      typingChannel.unsubscribe()
    }
  }

  const checkAuth = async () => {
    const user = await getSession()
    
    if (!user) {
      router.push('/auth')
      return
    }

    setCurrentUser(user)
    loadContacts(user.id)
    loadConversations(user.id)
    setLoading(false)
  }

  const loadConversations = async (userId: string) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error loading conversations:', error)
      return
    }
    if (!data) return

    // Get unique user IDs
    const userIds = new Set<string>()
    data.forEach(msg => {
      if (msg.sender_id !== userId) userIds.add(msg.sender_id)
      if (msg.recipient_id !== userId) userIds.add(msg.recipient_id)
    })

    // Fetch user details with Signal Protocol fields
    const { data: users } = await supabase
      .from('users')
      .select('id, username, display_name, identity_key_public, registration_id')
      .in('id', Array.from(userIds))

    if (!users) return

    // Create conversations with decrypted preview
    const convs = await Promise.all(users.map(async user => {
      const lastMsg = data.find(
        msg => msg.sender_id === user.id || msg.recipient_id === user.id
      )

      let preview = 'Start chatting...'
      if (lastMsg) {
        preview = lastMsg.ciphertext

        // Try to decrypt preview
        if (lastMsg.mac && lastMsg.mac !== 'no_encryption') {
          try {
            const session = await getSignalSession(userId, user.id)
            if (session && session.chain_key_recv) {
              const decrypted = decryptMessage(lastMsg.ciphertext, lastMsg.mac, session.chain_key_recv)
              if (decrypted) {
                preview = decrypted.message
              }
            }
          } catch (error) {
            console.error('Failed to decrypt preview:', error)
          }
        }
      }

      return {
        id: user.id,
        other_user: user,
        last_message: preview,
      }
    }))

    setConversations(convs)
  }

  const loadMessages = async (otherUserId: string) => {
    if (!currentUser) return

    try {
      // Use a simpler approach with two separate queries
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherUserId}),and(sender_id.eq.${otherUserId},recipient_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error loading messages:', error)
        return
      }

      if (data && Array.isArray(data)) {
        const mappedMessages = await Promise.all(data.map(async (msg) => {
          let content = msg.ciphertext || ''
          
          // Try to decrypt message if we have a session and it's encrypted
          if (msg.session_id && msg.mac && msg.mac !== 'no_encryption') {
            const session = await getSignalSession(currentUser.id, otherUserId)
            if (session) {
              // For received messages, use recv chain key
              // For sent messages, we already have the plaintext or use send chain key
              const chainKey = msg.sender_id === currentUser.id ? session.chain_key_send : session.chain_key_recv
              
              if (chainKey) {
                const decrypted = decryptMessage(msg.ciphertext, msg.mac, chainKey)
                if (decrypted) {
                  content = decrypted.message
                }
              }
            }
          }
          
          return {
            id: msg.id,
            sender_id: msg.sender_id,
            content,
            created_at: msg.created_at,
          }
        }))
        setMessages(mappedMessages)
      } else {
        setMessages([])
      }
    } catch (err) {
      console.error('Exception loading messages:', err)
      setMessages([])
    }
  }

  const handleTyping = () => {
    if (!selectedConversation || !currentUser) return

    // Send typing indicator
    supabase
      .channel(`typing-${selectedConversation}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUser.id, is_typing: true }
      })

    // Clear previous timeout
    if (typingTimeout) {
      clearTimeout(typingTimeout)
    }

    // Set timeout to stop typing indicator
    const timeout = setTimeout(() => {
      supabase
        .channel(`typing-${selectedConversation}`)
        .send({
          type: 'broadcast',
          event: 'typing',
          payload: { user_id: currentUser.id, is_typing: false }
        })
    }, 2000) // Stop typing indicator after 2 seconds

    setTypingTimeout(timeout)
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation || !currentUser) return

    // Stop typing indicator
    if (typingTimeout) {
      clearTimeout(typingTimeout)
      setTypingTimeout(null)
    }
    
    supabase
      .channel(`typing-${selectedConversation}`)
      .send({
        type: 'broadcast',
        event: 'typing',
        payload: { user_id: currentUser.id, is_typing: false }
      })

    // Get or create Signal Protocol session
    let session = await getSignalSession(currentUser.id, selectedConversation)
    if (!session) {
      // Create new session with shared secret (simplified - should use X3DH)
      const sharedSecret = 'temp_shared_secret_' + Date.now()
      session = await createSession(currentUser.id, selectedConversation, sharedSecret)
      if (!session) {
        console.error('Failed to create session')
        return
      }
    }

    // Simplified encryption - use shared chain key (don't update it)
    let ciphertext = newMessage
    let mac = 'no_encryption'

    if (session.chain_key_send) {
      const encrypted = encryptMessage(newMessage, session.chain_key_send)
      ciphertext = encrypted.ciphertext
      mac = encrypted.mac
      // DON'T update chain keys - keep them synchronized
    }

    // Send encrypted message
    const { data, error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      recipient_id: selectedConversation,
      session_id: session.id,
      ciphertext,
      mac,
      message_type: 'message',
      message_counter: session.send_counter + 1
    }).select()

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    // Update only the counter, not the chain keys
    await updateSession(session.id, {
      send_counter: session.send_counter + 1
    })

    // Add the sent message to local state immediately
    if (data && data[0]) {
      const sentMessage = {
        id: data[0].id,
        sender_id: currentUser.id,
        content: newMessage, // Use plaintext for sender
        created_at: data[0].created_at,
      }
      setMessages(prev => [...prev, sentMessage])
    }

    setNewMessage('')
  }

  const loadContacts = async (userId: string) => {
    const contactsList = await getUserContacts(userId)
    const contactUsers = contactsList.map(contact => contact.contact_user)
    setContacts(contactUsers)
  }

  const generateMyInviteCode = async () => {
    if (!currentUser) {
      alert('No user logged in')
      return
    }
    
    console.log('Generating invite code for user:', currentUser.id)
    const result = await generateInviteCode(currentUser.id)
    
    if (result.error) {
      console.error('Error generating invite code:', result.error)
      alert('Error generating invite code: ' + result.error)
      return
    }
    
    if (result.code) {
      setCurrentInviteCode(result.code)
      setShowInviteModal(true)
    } else {
      alert('No invite code returned')
    }
  }

  const handleAddContact = async () => {
    if (!currentUser || !addContactCode.trim()) return
    
    const result = await useInviteCode(addContactCode.trim(), currentUser.id)
    if (result.user) {
      // Reload contacts
      await loadContacts(currentUser.id)
      setShowAddContactModal(false)
      setAddContactCode('')
      // Start conversation with new contact
      setSelectedConversation(result.user.id)
      setSidebarOpen(false)
    } else {
      alert(result.error || 'Failed to add contact')
    }
  }

  const startConversation = (user: User) => {
    setSelectedConversation(user.id)
    setSidebarOpen(false) // Close sidebar on mobile when starting conversation
    
    if (!conversations.find(c => c.id === user.id)) {
      setConversations([
        {
          id: user.id,
          other_user: user,
          last_message: 'Start chatting...',
        },
        ...conversations,
      ])
    }
  }

  const logout = async () => {
    await clearSession()
    router.push('/auth')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-bg">
        <div className="animate-pulse text-dark-text-secondary">Loading...</div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex bg-dark-bg overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Signal Style */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
        fixed lg:relative
        w-80 sm:w-80 md:w-96 lg:w-80 xl:w-96
        bg-dark-surface
        border-r border-dark-border
        flex flex-col
        z-50 lg:z-auto
        transition-transform duration-200 ease-in-out
        h-full lg:h-auto
        inset-y-0 lg:inset-y-auto
      `}>
        <div className="flex-shrink-0 p-4 lg:p-5 border-b border-dark-border">
          <div className="flex items-center justify-between mb-4 lg:mb-5">
            <div className="flex items-center gap-3">
              <img
                src="/logo.png"
                alt="Whisper Logo"
                className="w-8 h-8 lg:w-9 lg:h-9 object-contain"
              />
              <h1 className="text-xl lg:text-2xl font-semibold text-dark-text">Whisper</h1>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2.5 hover:bg-dark-elevated rounded-lg lg:hidden transition-colors"
              >
                <svg className="w-5 h-5 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button onClick={logout} className="p-2.5 hover:bg-dark-elevated rounded-lg transition-colors">
                <svg className="w-5 h-5 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={generateMyInviteCode}
              className="w-full px-4 py-3 bg-accent-primary text-white rounded-xl hover:bg-accent-primary-hover font-medium text-base transition-colors"
            >
              Share Invite Code
            </button>

            <button
              onClick={() => setShowAddContactModal(true)}
              className="w-full px-4 py-3 bg-dark-elevated text-dark-text rounded-xl hover:bg-dark-border font-medium text-base transition-colors"
            >
              Add Contact
            </button>
          </div>

          {/* Contacts List */}
          <div className="mt-4">
            <h3 className="text-dark-text font-medium text-sm lg:text-base mb-2">Contacts</h3>
            {contacts.length > 0 ? (
              <div className="space-y-1">
                {contacts.map((contact) => (
                  <button
                    key={contact.id}
                    onClick={() => startConversation(contact)}
                    className="w-full px-3 lg:px-4 py-2 lg:py-3 hover:bg-dark-elevated text-left rounded-lg transition-colors"
                  >
                    <div className="font-medium text-dark-text text-sm lg:text-base">{contact.username}</div>
                    <div className="text-xs lg:text-sm text-dark-text-secondary">{contact.display_name || 'Anonymous User'}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-dark-text-secondary text-sm lg:text-base text-center py-4">
                No contacts yet. Share your invite code to connect with others.
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-dark-border scrollbar-track-transparent">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setSelectedConversation(conv.id)
                setSidebarOpen(false) // Close sidebar on mobile
              }}
              className={`w-full px-4 py-4 flex items-center gap-3 hover:bg-dark-elevated text-left transition-colors ${
                selectedConversation === conv.id ? 'bg-dark-elevated' : ''
              }`}
            >
              {/* Signal-style Avatar */}
              <div className="flex-shrink-0 w-12 h-12 bg-accent-primary rounded-full flex items-center justify-center">
                <span className="text-white font-semibold text-lg">
                  {conv.other_user.username?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>

              {/* Message Content */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-dark-text text-base mb-0.5">{conv.other_user.username}</div>
                <div className="text-sm text-dark-text-secondary truncate">{conv.last_message}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="flex-shrink-0 p-3 lg:p-4 border-t border-dark-border">
          <div className="font-medium text-dark-text text-sm lg:text-base">{currentUser?.username}</div>
          <div className="text-xs lg:text-sm text-dark-text-secondary">{currentUser?.display_name || 'Anonymous User'}</div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden relative">
        {selectedConversation ? (
          <>
            {/* Chat Header - Signal Style */}
            <div className="flex-shrink-0 px-4 py-3 lg:px-5 lg:py-4 border-b border-dark-border bg-dark-surface flex items-center">
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-2.5 hover:bg-dark-elevated rounded-lg mr-2 lg:hidden transition-colors"
              >
                <svg className="w-5 h-5 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 lg:w-10 lg:h-10 bg-accent-primary rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-base lg:text-lg">
                    {conversations.find(c => c.id === selectedConversation)?.other_user.username?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="font-semibold text-dark-text text-base lg:text-lg">
                  {conversations.find(c => c.id === selectedConversation)?.other_user.username}
                </div>
              </div>
            </div>

            {/* Messages - Full height, scrollable behind input */}
            <div className="absolute inset-0 top-[57px] lg:top-[65px] overflow-y-auto overflow-x-hidden p-4 lg:p-6 pb-[80px] lg:pb-[88px] space-y-2 scrollbar-thin scrollbar-thumb-dark-border scrollbar-track-transparent" style={{ WebkitOverflowScrolling: 'touch' }}>
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-dark-text-secondary text-base">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] sm:max-w-md lg:max-w-lg px-4 py-2.5 rounded-signal text-base break-words ${
                        msg.sender_id === currentUser?.id
                          ? 'bg-accent-outgoing text-white rounded-br-md'
                          : 'bg-accent-incoming text-dark-text rounded-bl-md'
                      }`}
                    >
                      {msg.content || '[Empty message]'}
                    </div>
                  </div>
                ))
              )}

              {/* Typing Indicator */}
              {typingUsers.size > 0 && (
                <div className="flex justify-start">
                  <div className="bg-accent-incoming text-dark-text-secondary px-4 py-3 rounded-signal rounded-bl-md">
                    <div className="flex space-x-1.5">
                      <div className="w-2 h-2 bg-dark-text-secondary rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-dark-text-secondary rounded-full animate-bounce" style={{animationDelay: '0.15s'}}></div>
                      <div className="w-2 h-2 bg-dark-text-secondary rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input - Signal Style */}
            <div className="fixed bottom-0 left-0 right-0 lg:left-80 xl:left-96 p-4 lg:p-5 border-t border-dark-border bg-dark-surface z-20">
              <form onSubmit={sendMessage} className="flex gap-3 items-end">
                <textarea
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    handleTyping()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      // Check if device is mobile (touch-enabled)
                      const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0

                      if (isMobile) {
                        // On mobile: Enter creates new line (default behavior)
                        return
                      } else {
                        // On desktop: Enter sends (unless Shift is held)
                        if (!e.shiftKey) {
                          e.preventDefault()
                          sendMessage(e)
                        }
                        // Shift+Enter creates new line (default behavior)
                      }
                    }
                  }}
                  onFocus={() => {
                    // Prevent zoom on focus
                    if (typeof window !== 'undefined') {
                      const viewport = document.querySelector('meta[name=viewport]')
                      if (viewport) {
                        viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
                      }
                    }
                  }}
                  onBlur={() => {
                    // Reset zoom when keyboard dismisses
                    setTimeout(() => {
                      if (typeof window !== 'undefined') {
                        const viewport = document.querySelector('meta[name=viewport]')
                        if (viewport) {
                          viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
                        }
                        window.scrollTo(0, 0)
                      }
                    }, 100)
                  }}
                  placeholder="Message"
                  rows={1}
                  className="flex-1 px-4 py-3 bg-dark-elevated border border-dark-border rounded-signal text-dark-text text-base placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary resize-none overflow-y-auto max-h-32 transition-colors"
                  style={{ fontSize: '16px' }}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="w-11 h-11 bg-accent-primary text-white rounded-full hover:bg-accent-primary-hover font-medium flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-dark-text-secondary p-6 bg-dark-bg">
            <button
              onClick={() => setSidebarOpen(true)}
              className="mb-8 p-4 bg-accent-primary text-white rounded-full hover:bg-accent-primary-hover lg:hidden shadow-lg transition-all"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="text-center">
              <div className="mb-6">
                <img
                  src="/logo.png"
                  alt="Whisper Logo"
                  className="w-20 h-20 lg:w-24 lg:h-24 mx-auto object-contain opacity-40"
                />
              </div>
              <p className="text-base lg:text-lg font-medium text-dark-text-secondary">Select a contact to start messaging</p>
              <p className="text-sm text-dark-text-secondary mt-2 opacity-75">Your conversations will appear here</p>
            </div>
          </div>
        )}
      </div>

      {/* Invite Code Modal - Signal Style */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-dark-surface rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-dark-text font-semibold text-xl mb-3">Share Your Invite Code</h2>
            <p className="text-dark-text-secondary text-base mb-5">
              Share this code with someone to add them as a contact. Code expires in 24 hours.
            </p>
            <div className="bg-dark-elevated p-5 rounded-xl mb-5">
              <div className="text-center">
                <div className="text-3xl font-mono font-bold text-accent-primary mb-3 tracking-wider">
                  {currentInviteCode}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(currentInviteCode)}
                  className="text-dark-text-secondary hover:text-dark-text text-sm transition-colors"
                >
                  Tap to copy
                </button>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-3 bg-dark-elevated text-dark-text rounded-xl hover:bg-dark-border font-medium transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(currentInviteCode)}
                className="flex-1 px-4 py-3 bg-accent-primary text-white rounded-xl hover:bg-accent-primary-hover font-medium transition-colors"
              >
                Copy Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal - Signal Style */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-dark-surface rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h2 className="text-dark-text font-semibold text-xl mb-3">Add Contact</h2>
            <p className="text-dark-text-secondary text-base mb-5">
              Enter the invite code someone shared with you to add them as a contact.
            </p>
            <input
              type="text"
              value={addContactCode}
              onChange={(e) => setAddContactCode(e.target.value.toUpperCase())}
              placeholder="ENTER CODE"
              className="w-full px-4 py-3.5 bg-dark-elevated border border-dark-border rounded-xl text-dark-text mb-5 font-mono text-center text-xl font-semibold tracking-wider placeholder-dark-text-secondary focus:outline-none focus:border-accent-primary transition-colors"
              maxLength={8}
              style={{ fontSize: '20px' }}
            />
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowAddContactModal(false)
                  setAddContactCode('')
                }}
                className="flex-1 px-4 py-3 bg-dark-elevated text-dark-text rounded-xl hover:bg-dark-border font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                disabled={!addContactCode.trim()}
                className="flex-1 px-4 py-3 bg-accent-primary text-white rounded-xl hover:bg-accent-primary-hover font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Add Contact
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
