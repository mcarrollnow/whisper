// Privacy-focused authentication without email requirements
import { supabase } from './supabase'
import bcrypt from 'bcryptjs'

export interface PrivateUser {
  id: string
  username: string
  display_name?: string
  created_at: string
  last_seen: string
}

export interface AuthResult {
  user?: PrivateUser
  error?: string
}

// Generate anonymous username
export async function generateUsername(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_anonymous_username')
  
  if (error) {
    console.error('Error generating username:', error)
    // Fallback generation
    const prefixes = ['whisper', 'secure', 'private', 'anon', 'ghost', 'shadow', 'cipher', 'vault']
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const number = Math.floor(Math.random() * 9999) + 1
    return `@${prefix}.${number}`
  }
  
  return data
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
      .select('id, username, display_name, created_at, last_seen')
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
      .select('id, username, display_name, password_hash, created_at, last_seen')
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
    
    // Update last seen
    await supabase
      .from('users')
      .update({ last_seen: new Date().toISOString() })
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
      .select('id, username, display_name, created_at, last_seen')
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
      .select('id, username, display_name, created_at, last_seen')
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

// Session management (using localStorage for privacy)
const SESSION_KEY = 'whisper_session'

export function saveSession(user: PrivateUser) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user))
}

export function getSession(): PrivateUser | null {
  try {
    const session = localStorage.getItem(SESSION_KEY)
    return session ? JSON.parse(session) : null
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
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
