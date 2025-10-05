import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Message = {
  id: string
  sender_id: string
  recipient_id: string
  encrypted_content: string
  created_at: string
}

export type User = {
  id: string
  email: string
  username: string
  identity_key: string
  signed_pre_key: string
  pre_key_signature: string
  created_at: string
}
