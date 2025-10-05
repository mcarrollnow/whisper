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
    if (selectedConversation && currentUser) {
      loadMessages(selectedConversation)
      setupRealtimeSubscription()
    }
    
    return () => {
      // Cleanup subscriptions when conversation changes
      supabase.removeAllChannels()
    }
  }, [selectedConversation, currentUser])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, typingUsers])

  const setupRealtimeSubscription = () => {
    if (!selectedConversation || !currentUser) return

    // Subscribe to new messages
    const messageChannel = supabase
      .channel(`messages-${selectedConversation}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `or(and(sender_id.eq.${currentUser.id},recipient_id.eq.${selectedConversation}),and(sender_id.eq.${selectedConversation},recipient_id.eq.${currentUser.id}))`
        },
        async (payload) => {
          let content = payload.new.ciphertext || ''
          
          // Try to decrypt real-time message
          if (payload.new.session_id && payload.new.mac && currentUser && payload.new.mac !== 'no_encryption') {
            const session = await getSignalSession(currentUser.id, selectedConversation!)
            if (session && session.chain_key_recv) {
              const decrypted = decryptMessage(payload.new.ciphertext, payload.new.mac, session.chain_key_recv)
              if (decrypted) {
                content = decrypted.message
                // Update session with new chain key
                await updateSession(session.id, { 
                  chain_key_recv: decrypted.newChainKey,
                  recv_counter: session.recv_counter + 1
                })
              }
            }
          }
          
          const newMessage = {
            id: payload.new.id,
            sender_id: payload.new.sender_id,
            content,
            created_at: payload.new.created_at,
          }
          setMessages(prev => [...prev, newMessage])
        }
      )
      .subscribe()

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
      .subscribe()
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

    // Create conversations
    const convs = users.map(user => {
      const lastMsg = data.find(
        msg => msg.sender_id === user.id || msg.recipient_id === user.id
      )
      return {
        id: user.id,
        other_user: user,
        last_message: lastMsg?.ciphertext || 'Start chatting...',
      }
    })

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

    // Encrypt message using Signal Protocol
    let ciphertext = newMessage
    let mac = 'no_encryption'
    let newChainKey = session.chain_key_send

    if (session.chain_key_send) {
      const encrypted = encryptMessage(newMessage, session.chain_key_send)
      ciphertext = encrypted.ciphertext
      mac = encrypted.mac
      newChainKey = encrypted.newChainKey
    } else {
      // Initialize chain key if not exists
      newChainKey = 'initial_chain_key_' + Date.now()
    }

    // Send encrypted message
    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      recipient_id: selectedConversation,
      session_id: session.id,
      ciphertext,
      mac,
      message_type: 'message',
      message_counter: session.send_counter + 1
    })

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    // Update session state
    await updateSession(session.id, {
      chain_key_send: newChainKey,
      send_counter: session.send_counter + 1
    })

    setNewMessage('')
    // Don't reload messages - real-time subscription will handle it
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
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-bg">
        <div className="animate-pulse text-dark-text-secondary">Loading...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-dark-bg relative overflow-hidden">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        lg:translate-x-0 
        fixed lg:relative 
        w-80 sm:w-80 md:w-96 lg:w-80 xl:w-96
        bg-dark-surface 
        border-r border-dark-border 
        flex flex-col 
        z-50 lg:z-auto
        transition-transform duration-300 ease-in-out
        h-full
        overflow-y-auto
      `}>
        <div className="flex-shrink-0 p-3 lg:p-4 border-b border-dark-border">
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <div className="flex items-center gap-2">
              <img 
                src="/logo.png" 
                alt="Whisper Logo" 
                className="w-6 h-6 lg:w-7 lg:h-7 object-contain"
              />
              <h1 className="text-lg lg:text-xl font-bold text-dark-text">Whisper</h1>
            </div>
            <div className="flex items-center gap-1 lg:gap-2">
              <button 
                onClick={() => setSidebarOpen(false)} 
                className="p-2 hover:bg-dark-elevated rounded-lg lg:hidden"
              >
                <svg className="w-4 h-4 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button onClick={logout} className="p-2 hover:bg-dark-elevated rounded-lg">
                <svg className="w-4 h-4 lg:w-5 lg:h-5 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="space-y-2">
            <button
              onClick={generateMyInviteCode}
              className="w-full px-3 lg:px-4 py-2 lg:py-3 bg-accent-primary text-white rounded-lg hover:bg-blue-600 font-medium text-sm lg:text-base"
            >
              Share Invite Code
            </button>
            
            <button
              onClick={() => setShowAddContactModal(true)}
              className="w-full px-3 lg:px-4 py-2 lg:py-3 bg-dark-elevated border border-dark-border text-dark-text rounded-lg hover:bg-dark-surface font-medium text-sm lg:text-base"
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
              className={`w-full px-3 lg:px-4 py-3 lg:py-4 border-b border-dark-border hover:bg-dark-elevated text-left transition-colors ${
                selectedConversation === conv.id ? 'bg-dark-elevated' : ''
              }`}
            >
              <div className="font-medium text-dark-text text-sm lg:text-base mb-1">{conv.other_user.username}</div>
              <div className="text-xs lg:text-sm text-dark-text-secondary truncate">{conv.last_message}</div>
            </button>
          ))}
        </div>

        <div className="flex-shrink-0 p-3 lg:p-4 border-t border-dark-border">
          <div className="font-medium text-dark-text text-sm lg:text-base">{currentUser?.username}</div>
          <div className="text-xs lg:text-sm text-dark-text-secondary">{currentUser?.display_name || 'Anonymous User'}</div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="flex-shrink-0 p-3 lg:p-4 border-b border-dark-border bg-dark-surface flex items-center">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-dark-elevated rounded-lg mr-2 lg:hidden"
              >
                <svg className="w-4 h-4 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center">
                <div className="w-7 h-7 lg:w-8 lg:h-8 bg-accent-primary rounded-full flex items-center justify-center mr-2 lg:mr-3">
                  <span className="text-white font-medium text-xs lg:text-sm">
                    {conversations.find(c => c.id === selectedConversation)?.other_user.username?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="font-medium text-dark-text text-sm lg:text-base">
                  {conversations.find(c => c.id === selectedConversation)?.other_user.username}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3 lg:p-4 space-y-2 lg:space-y-3 scrollbar-thin scrollbar-thumb-dark-border scrollbar-track-transparent">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-dark-text-secondary text-sm">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md xl:max-w-lg px-3 lg:px-4 py-2 lg:py-3 rounded-2xl text-sm lg:text-base ${
                        msg.sender_id === currentUser?.id
                          ? 'bg-accent-primary text-white'
                          : 'bg-dark-elevated text-dark-text'
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
                  <div className="bg-dark-elevated text-dark-text px-3 lg:px-4 py-2 lg:py-3 rounded-2xl text-sm lg:text-base">
                    <div className="flex items-center space-x-1">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-dark-text-secondary rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-dark-text-secondary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-dark-text-secondary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                      <span className="text-dark-text-secondary text-xs ml-2">typing...</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="flex-shrink-0 p-4 border-t border-dark-border bg-dark-surface" style={{paddingBottom: 'max(16px, env(safe-area-inset-bottom))'}}>
              <form onSubmit={sendMessage} className="flex gap-2 lg:gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value)
                    handleTyping()
                  }}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-dark-elevated border-2 border-dark-border rounded-full text-dark-text text-base focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-accent-primary min-h-[44px]"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-accent-primary text-white rounded-full hover:bg-blue-600 font-medium text-base min-h-[44px] min-w-[80px] flex items-center justify-center"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-dark-text-secondary p-6">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="mb-6 p-4 bg-accent-primary text-white rounded-full hover:bg-blue-600 lg:hidden shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="text-center">
              <div className="mb-4 lg:mb-6">
                <img 
                  src="/logo.png" 
                  alt="Whisper Logo" 
                  className="w-16 h-16 lg:w-20 lg:h-20 mx-auto object-contain opacity-50"
                />
              </div>
              <p className="text-sm lg:text-base">Select a contact to start messaging</p>
            </div>
          </div>
        )}
      </div>

      {/* Invite Code Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-surface rounded-lg p-6 max-w-md w-full">
            <h2 className="text-dark-text font-bold text-lg mb-4">Share Your Invite Code</h2>
            <p className="text-dark-text-secondary text-sm mb-4">
              Share this code with someone to add them as a contact. Code expires in 24 hours.
            </p>
            <div className="bg-dark-elevated p-4 rounded-lg mb-4">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-accent-primary mb-2">
                  {currentInviteCode}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(currentInviteCode)}
                  className="text-dark-text-secondary hover:text-dark-text text-sm"
                >
                  Click to copy
                </button>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-2 bg-dark-elevated text-dark-text rounded-lg hover:bg-dark-border"
              >
                Close
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(currentInviteCode)}
                className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-blue-600"
              >
                Copy Code
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Contact Modal */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-dark-surface rounded-lg p-6 max-w-md w-full">
            <h2 className="text-dark-text font-bold text-lg mb-4">Add Contact</h2>
            <p className="text-dark-text-secondary text-sm mb-4">
              Enter the invite code someone shared with you to add them as a contact.
            </p>
            <input
              type="text"
              value={addContactCode}
              onChange={(e) => setAddContactCode(e.target.value.toUpperCase())}
              placeholder="Enter invite code..."
              className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text mb-4 font-mono text-center text-lg"
              maxLength={8}
            />
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowAddContactModal(false)
                  setAddContactCode('')
                }}
                className="flex-1 px-4 py-2 bg-dark-elevated text-dark-text rounded-lg hover:bg-dark-border"
              >
                Cancel
              </button>
              <button
                onClick={handleAddContact}
                disabled={!addContactCode.trim()}
                className="flex-1 px-4 py-2 bg-accent-primary text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
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
