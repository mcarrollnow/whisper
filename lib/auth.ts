// Privacy-focused authentication without email requirements
import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

export interface PrivateUser {
  id: string
  username: string
  display_name?: string
  created_at: string
}

export interface AuthResult {
  user?: PrivateUser
  error?: string
}

// Generate anonymous username (client-side)
export async function generateUsername(): Promise<string> {
  let attempts = 0
  const maxAttempts = 10
  
  while (attempts < maxAttempts) {
    const prefixes = ['whisper', 'secure', 'private', 'anon', 'ghost', 'shadow', 'cipher', 'vault']
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const number = Math.floor(Math.random() * 9999) + 1
    const username = `@${prefix}.${number}`
    
    // Check if username is available
    const isAvailable = await isUsernameAvailable(username)
    if (isAvailable) {
      return username
    }
    
    attempts++
  }
  
  // Fallback to timestamp-based username
  return `@user.${Date.now()}`
}

// Create account with just username and password
export async function createAccount(password: string, displayName?: string): Promise<AuthResult> {
  try {
    // Generate anonymous username
    const username = await generateUsername()
    
    // Hash password client-side for extra security
    const saltRounds = 12
    const passwordHash = await bcrypt.hash(password, saltRounds)
    
    // Create user record
    const { data, error } = await supabase
      .from('users')
      .insert({
        username,
        display_name: displayName || null,
        password_hash: passwordHash
      })
      .select('id, username, display_name, created_at')
      .single()
    
    if (error) {
      return { error: error.message }
    }
    
    return { user: data }
  } catch (err: any) {
    return { error: err.message }
  }
}

// Login with username and password
export async function loginWithUsername(username: string, password: string): Promise<AuthResult> {
  try {
    // Get user by username
    const { data: user, error } = await supabase
      .from('users')
      .select('id, username, display_name, password_hash, created_at')
      .eq('username', username)
      .single()
    
    if (error || !user) {
      return { error: 'Invalid username or password' }
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash)
    
    if (!isValidPassword) {
      return { error: 'Invalid username or password' }
    }
    
    // Update updated_at timestamp
    await supabase
      .from('users')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', user.id)
    
    // Return user without password hash
    const { password_hash, ...safeUser } = user
    return { user: safeUser }
  } catch (err: any) {
    return { error: err.message }
  }
}

// Search users by username (for adding contacts)
export async function searchUsersByUsername(query: string, currentUserId: string): Promise<PrivateUser[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, created_at')
      .ilike('username', `%${query}%`)
      .neq('id', currentUserId)
      .limit(10)
    
    if (error) {
      console.error('Error searching users:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('Exception searching users:', err)
    return []
  }
}

// Get user by ID (for message display)
export async function getUserById(userId: string): Promise<PrivateUser | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, created_at')
      .eq('id', userId)
      .single()
    
    if (error) {
      console.error('Error getting user:', error)
      return null
    }
    
    return data
  } catch (err) {
    console.error('Exception getting user:', err)
    return null
  }
}

// Update display name
export async function updateDisplayName(userId: string, displayName: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({ display_name: displayName })
      .eq('id', userId)
    
    return !error
  } catch (err) {
    console.error('Error updating display name:', err)
    return false
  }
}

// Secure session management with tokens
const SESSION_KEY = 'whisper_session'
const TOKEN_KEY = 'whisper_token'

interface SecureSession {
  user: PrivateUser
  token: string
  expires: number
}

export function saveSession(user: PrivateUser) {
  // Generate a secure session token
  const token = generateSecureToken()
  const expires = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  
  const session: SecureSession = {
    user,
    token,
    expires
  }
  
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getSession(): PrivateUser | null {
  try {
    const sessionData = localStorage.getItem(SESSION_KEY)
    if (!sessionData) return null
    
    const session: SecureSession = JSON.parse(sessionData)
    
    // Check if session is expired
    if (Date.now() > session.expires) {
      clearSession()
      return null
    }
    
    return session.user
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

function generateSecureToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Check if username is available
export async function isUsernameAvailable(username: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('username', username)
      .single()
    
    // If no error and data exists, username is taken
    return error !== null
  } catch {
    return true
  }
}
