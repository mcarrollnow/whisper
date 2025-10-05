'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type User = {
  id: string
  email: string
  username: string
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
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [showSearch, setShowSearch] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  useEffect(() => {
    if (selectedConversation && currentUser) {
      loadMessages(selectedConversation)
    }
  }, [selectedConversation])

  const checkAuth = async () => {
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

    setCurrentUser(profile)
    if (profile) {
      loadConversations(user.id)
    }
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

    // Fetch user details
    const { data: users } = await supabase
      .from('users')
      .select('id, username, email')
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
        last_message: lastMsg?.encrypted_content || 'Start chatting...',
      }
    })

    setConversations(convs)
  }

  const loadMessages = async (otherUserId: string) => {
    if (!currentUser) return

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`sender_id.eq.${currentUser.id}.and.recipient_id.eq.${otherUserId},sender_id.eq.${otherUserId}.and.recipient_id.eq.${currentUser.id}`)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Error loading messages:', error)
      return
    }

    if (data) {
      setMessages(data.map(msg => ({
        id: msg.id,
        sender_id: msg.sender_id,
        content: msg.encrypted_content, // Keep encrypted content as-is
        created_at: msg.created_at,
      })))
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !selectedConversation || !currentUser) return

    const { error } = await supabase.from('messages').insert({
      sender_id: currentUser.id,
      recipient_id: selectedConversation,
      encrypted_content: newMessage, // Store as encrypted content
    })

    if (error) {
      console.error('Error sending message:', error)
      return
    }

    setNewMessage('')
    loadMessages(selectedConversation)
  }

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    const { data } = await supabase
      .from('users')
      .select('id, username, email')
      .ilike('username', `%${query}%`)
      .neq('id', currentUser?.id || '')
      .limit(10)

    setSearchResults(data || [])
  }

  const startConversation = (user: User) => {
    setSelectedConversation(user.id)
    setShowSearch(false)
    setSearchQuery('')
    setSearchResults([])
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
    <div className="flex h-screen bg-dark-bg relative">
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
        w-80 sm:w-96 lg:w-80 
        bg-dark-surface 
        border-r border-dark-border 
        flex flex-col 
        z-50 
        transition-transform duration-300 ease-in-out
        h-full
      `}>
        <div className="p-4 border-b border-dark-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-dark-text">Whisper</h1>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setSidebarOpen(false)} 
                className="p-2 hover:bg-dark-elevated rounded-lg lg:hidden"
              >
                <svg className="w-5 h-5 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <button onClick={logout} className="p-2 hover:bg-dark-elevated rounded-lg">
                <svg className="w-5 h-5 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
          
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="w-full px-4 py-3 bg-accent-primary text-white rounded-lg hover:bg-blue-600 font-medium"
          >
            + New Message
          </button>

          {showSearch && (
            <div className="mt-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  searchUsers(e.target.value)
                }}
                placeholder="Search users..."
                className="w-full px-4 py-3 bg-dark-elevated border border-dark-border rounded-lg text-dark-text text-base"
              />
              {searchResults.length > 0 && (
                <div className="mt-2 bg-dark-elevated rounded-lg max-h-60 overflow-y-auto">
                  {searchResults.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => startConversation(user)}
                      className="w-full px-4 py-4 hover:bg-dark-surface text-left border-b border-dark-border last:border-b-0"
                    >
                      <div className="font-medium text-dark-text text-base">{user.username}</div>
                      <div className="text-sm text-dark-text-secondary">{user.email}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => {
                setSelectedConversation(conv.id)
                setSidebarOpen(false) // Close sidebar on mobile
              }}
              className={`w-full px-4 py-4 border-b border-dark-border hover:bg-dark-elevated text-left transition-colors ${
                selectedConversation === conv.id ? 'bg-dark-elevated' : ''
              }`}
            >
              <div className="font-medium text-dark-text text-base mb-1">{conv.other_user.username}</div>
              <div className="text-sm text-dark-text-secondary truncate">{conv.last_message}</div>
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-dark-border">
          <div className="font-medium text-dark-text text-base">{currentUser?.username}</div>
          <div className="text-sm text-dark-text-secondary">{currentUser?.email}</div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-dark-border bg-dark-surface flex items-center">
              <button 
                onClick={() => setSidebarOpen(true)}
                className="p-2 hover:bg-dark-elevated rounded-lg mr-3 lg:hidden"
              >
                <svg className="w-5 h-5 text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-accent-primary rounded-full flex items-center justify-center mr-3">
                  <span className="text-white font-medium text-sm">
                    {conversations.find(c => c.id === selectedConversation)?.other_user.username?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div className="font-medium text-dark-text text-base">
                  {conversations.find(c => c.id === selectedConversation)?.other_user.username}
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender_id === currentUser?.id ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs sm:max-w-sm md:max-w-md px-4 py-3 rounded-2xl text-base ${
                      msg.sender_id === currentUser?.id
                        ? 'bg-accent-primary text-white'
                        : 'bg-dark-elevated text-dark-text'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-dark-border bg-dark-surface">
              <form onSubmit={sendMessage} className="flex gap-3">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-3 bg-dark-elevated border border-dark-border rounded-full text-dark-text text-base focus:outline-none focus:ring-2 focus:ring-accent-primary"
                />
                <button
                  type="submit"
                  className="px-6 py-3 bg-accent-primary text-white rounded-full hover:bg-blue-600 font-medium min-w-[80px]"
                >
                  Send
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-dark-text-secondary p-8">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="mb-4 p-3 bg-accent-primary text-white rounded-full hover:bg-blue-600 lg:hidden"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="text-center">
              <h2 className="text-xl font-medium text-dark-text mb-2">Welcome to Whisper</h2>
              <p className="text-dark-text-secondary">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
