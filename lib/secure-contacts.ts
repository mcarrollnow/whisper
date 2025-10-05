// Secure contact management with invite codes
import { supabase } from './supabase'
import { SignalUser } from './signal-auth'

export interface Contact {
  id: string
  user_id: string
  contact_user_id: string
  contact_user: SignalUser
  created_at: string
}

export interface InviteCode {
  id: string
  code: string
  expires_at: string
  used: boolean
  created_at: string
}

// Generate a new invite code for the current user
export async function generateInviteCode(userId: string): Promise<{ code?: string, error?: string }> {
  try {
    const { data, error } = await supabase.rpc('create_invite_code', {
      p_user_id: userId
    })
    
    if (error) {
      return { error: error.message }
    }
    
    return { code: data }
  } catch (err: any) {
    return { error: err.message }
  }
}

// Get current active invite code for user
export async function getCurrentInviteCode(userId: string): Promise<InviteCode | null> {
  try {
    const { data, error } = await supabase
      .from('invite_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    if (error) {
      return null
    }
    
    return data
  } catch (err) {
    return null
  }
}

// Use an invite code to add a contact
export async function useInviteCode(code: string, requestingUserId: string): Promise<{ user?: SignalUser, error?: string }> {
  try {
    const { data, error } = await supabase.rpc('use_invite_code', {
      p_code: code.toUpperCase(),
      p_requesting_user_id: requestingUserId
    })
    
    if (error) {
      return { error: error.message }
    }
    
    if (!data.success) {
      return { error: data.error }
    }
    
    return { user: data.user }
  } catch (err: any) {
    return { error: err.message }
  }
}

// Get all contacts for a user
export async function getUserContacts(userId: string): Promise<Contact[]> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select(`
        *,
        contact_user:contact_user_id (
          id,
          username,
          display_name,
          identity_key_public,
          registration_id,
          created_at
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching contacts:', error)
      return []
    }
    
    return data || []
  } catch (err) {
    console.error('Exception fetching contacts:', err)
    return []
  }
}

// Check if two users are contacts
export async function areUsersContacts(userId1: string, userId2: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .eq('user_id', userId1)
      .eq('contact_user_id', userId2)
      .single()
    
    return !error && !!data
  } catch (err) {
    return false
  }
}

// Remove a contact (bidirectional)
export async function removeContact(userId: string, contactUserId: string): Promise<boolean> {
  try {
    // Remove both directions of the contact relationship
    const { error: error1 } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', userId)
      .eq('contact_user_id', contactUserId)
    
    const { error: error2 } = await supabase
      .from('contacts')
      .delete()
      .eq('user_id', contactUserId)
      .eq('contact_user_id', userId)
    
    return !error1 && !error2
  } catch (err) {
    console.error('Error removing contact:', err)
    return false
  }
}

// Get contact by user ID (if they are contacts)
export async function getContactByUserId(currentUserId: string, targetUserId: string): Promise<SignalUser | null> {
  try {
    // First check if they are contacts
    const areContacts = await areUsersContacts(currentUserId, targetUserId)
    if (!areContacts) {
      return null
    }
    
    // Get the contact user info
    const { data, error } = await supabase
      .from('users')
      .select('id, username, display_name, identity_key_public, registration_id, created_at')
      .eq('id', targetUserId)
      .single()
    
    if (error) {
      return null
    }
    
    return data
  } catch (err) {
    return null
  }
}
