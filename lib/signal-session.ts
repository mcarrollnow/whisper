// Signal Protocol session management for Double Ratchet
import { supabase } from './supabase'

export interface SignalSession {
  id: string
  alice_id: string
  bob_id: string
  session_id: string
  root_key: string
  chain_key_send?: string
  chain_key_recv?: string
  dh_ratchet_key_send?: string
  dh_ratchet_key_recv?: string
  send_counter: number
  recv_counter: number
  prev_counter: number
}

// Create a new Signal Protocol session
export async function createSession(
  aliceId: string, 
  bobId: string, 
  sharedSecret: string
): Promise<SignalSession | null> {
  try {
    // Generate session ID
    const sessionId = generateSessionId(aliceId, bobId)
    
    // Initialize Double Ratchet with shared secret as root key
    const rootKey = sharedSecret
    const initialChainKey = deriveKey(rootKey, 'initial_chain')
    
    const { data, error } = await supabase
      .from('sessions')
      .insert({
        alice_id: aliceId,
        bob_id: bobId,
        session_id: sessionId,
        root_key: rootKey,
        chain_key_send: initialChainKey,
        chain_key_recv: initialChainKey,
        send_counter: 0,
        recv_counter: 0,
        prev_counter: 0
      })
      .select('*')
      .single()
    
    if (error) {
      console.error('Error creating session:', error)
      return null
    }
    
    return data
  } catch (err) {
    console.error('Exception creating session:', err)
    return null
  }
}

// Get existing session between two users
export async function getSession(userId1: string, userId2: string): Promise<SignalSession | null> {
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .or(`and(alice_id.eq.${userId1},bob_id.eq.${userId2}),and(alice_id.eq.${userId2},bob_id.eq.${userId1})`)
      .single()
    
    if (error) {
      return null
    }
    
    return data
  } catch (err) {
    return null
  }
}

// Update session state after sending/receiving messages
export async function updateSession(sessionId: string, updates: Partial<SignalSession>): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('sessions')
      .update({
        ...updates,
        last_used: new Date().toISOString()
      })
      .eq('id', sessionId)
    
    return !error
  } catch (err) {
    console.error('Error updating session:', err)
    return false
  }
}

// Generate deterministic session ID for two users
function generateSessionId(userId1: string, userId2: string): string {
  // Sort user IDs to ensure consistent session ID regardless of order
  const sortedIds = [userId1, userId2].sort()
  return `session_${sortedIds[0]}_${sortedIds[1]}`
}

// Derive new keys using HKDF-like key derivation (simplified)
export function deriveKey(inputKey: string, info: string): string {
  // Simplified key derivation - in production use proper HKDF
  const combined = inputKey + info
  const hash = Array.from(new TextEncoder().encode(combined))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  return hash.substring(0, 64) // 32 bytes as hex
}

// Encrypt message with current chain key (simplified)
export function encryptMessage(message: string, chainKey: string): { ciphertext: string, mac: string, newChainKey: string } {
  // Simplified encryption - in production use proper AES-GCM
  const messageKey = deriveKey(chainKey, 'message')
  const newChainKey = deriveKey(chainKey, 'chain')
  
  // XOR encryption (placeholder - use proper AES in production)
  const messageBytes = new TextEncoder().encode(message)
  const keyBytes = new TextEncoder().encode(messageKey.substring(0, message.length))
  
  const ciphertext = Array.from(messageBytes)
    .map((b, i) => b ^ (keyBytes[i] || 0))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  
  // Generate MAC (placeholder - use proper HMAC in production)
  const mac = deriveKey(messageKey, 'mac').substring(0, 32)
  
  return { ciphertext, mac, newChainKey }
}

// Decrypt message with chain key (simplified)
export function decryptMessage(ciphertext: string, mac: string, chainKey: string): { message: string, newChainKey: string } | null {
  try {
    const messageKey = deriveKey(chainKey, 'message')
    const newChainKey = deriveKey(chainKey, 'chain')
    
    // Verify MAC (simplified)
    const expectedMac = deriveKey(messageKey, 'mac').substring(0, 32)
    if (mac !== expectedMac) {
      console.error('MAC verification failed')
      return null
    }
    
    // XOR decryption (placeholder)
    const cipherBytes = []
    for (let i = 0; i < ciphertext.length; i += 2) {
      cipherBytes.push(parseInt(ciphertext.substr(i, 2), 16))
    }
    
    const keyBytes = new TextEncoder().encode(messageKey.substring(0, cipherBytes.length))
    const messageBytes = cipherBytes.map((b, i) => b ^ (keyBytes[i] || 0))
    
    const message = new TextDecoder().decode(new Uint8Array(messageBytes))
    
    return { message, newChainKey }
  } catch (err) {
    console.error('Decryption failed:', err)
    return null
  }
}
