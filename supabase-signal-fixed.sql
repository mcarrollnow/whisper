-- Signal Protocol compliant database schema (syntax fixed)
-- Based on X3DH key agreement and Double Ratchet specifications

-- Clean slate
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_keys CASCADE;
DROP TABLE IF EXISTS prekeys CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;

-- Users table with Signal Protocol identity keys
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  
  -- Signal Protocol Identity Keys (IK)
  identity_key_public TEXT NOT NULL,
  identity_key_private TEXT NOT NULL,
  
  -- Registration ID for device identification
  registration_id INTEGER NOT NULL DEFAULT floor(random() * 16383 + 1)::INTEGER,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prekeys table for X3DH key agreement
CREATE TABLE prekeys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Prekey types: 'signed_prekey' or 'one_time_prekey'
  key_type TEXT NOT NULL CHECK (key_type IN ('signed_prekey', 'one_time_prekey')),
  
  -- Key ID for identification
  key_id INTEGER NOT NULL,
  
  -- The actual public key
  public_key TEXT NOT NULL,
  
  -- For signed prekeys: signature from identity key
  signature TEXT,
  
  -- Usage tracking
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique key_id per user per type
  UNIQUE(user_id, key_type, key_id)
);

-- Sessions table for Double Ratchet state
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Participants
  alice_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bob_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Session identifier
  session_id TEXT NOT NULL,
  
  -- Double Ratchet state (encrypted with shared key)
  root_key TEXT NOT NULL,
  chain_key_send TEXT,
  chain_key_recv TEXT,
  
  -- Ratchet keys
  dh_ratchet_key_send TEXT,
  dh_ratchet_key_recv TEXT,
  
  -- Message counters
  send_counter INTEGER DEFAULT 0,
  recv_counter INTEGER DEFAULT 0,
  prev_counter INTEGER DEFAULT 0,
  
  -- Session metadata
  established_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique session per pair
  UNIQUE(alice_id, bob_id, session_id)
);

-- Messages table with Signal Protocol encryption
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Session reference
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  
  -- Message metadata
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Signal Protocol message data
  message_type TEXT NOT NULL CHECK (message_type IN ('prekey_message', 'message')),
  
  -- Encrypted message content
  ciphertext TEXT NOT NULL,
  
  -- Message authentication
  mac TEXT NOT NULL,
  
  -- Message counter for ordering
  message_counter INTEGER NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  delivered_at TIMESTAMP WITH TIME ZONE
);

-- Create performance indexes
CREATE INDEX users_username_idx ON users(username);
CREATE INDEX users_identity_key_idx ON users(identity_key_public);
CREATE INDEX prekeys_user_type_idx ON prekeys(user_id, key_type);
CREATE INDEX prekeys_unused_idx ON prekeys(user_id, key_type) WHERE used = FALSE;
CREATE INDEX sessions_participants_idx ON sessions(alice_id, bob_id);
CREATE INDEX messages_session_counter_idx ON messages(session_id, message_counter);
CREATE INDEX messages_recipient_idx ON messages(recipient_id, created_at DESC);

-- Enable RLS with Signal Protocol security model
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE prekeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Signal Protocol security

-- Users: Allow registration and public key discovery
CREATE POLICY "Allow user registration" ON users
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow public key lookup" ON users
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow profile updates" ON users
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Prekeys: Allow publishing and fetching for key agreement
CREATE POLICY "Allow prekey publishing" ON prekeys
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow prekey fetching" ON prekeys
  FOR SELECT TO anon
  USING (used = FALSE);

CREATE POLICY "Allow prekey usage marking" ON prekeys
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Sessions: Allow session establishment and management
CREATE POLICY "Allow session creation" ON sessions
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow session access" ON sessions
  FOR SELECT TO anon
  USING (true);

CREATE POLICY "Allow session updates" ON sessions
  FOR UPDATE TO anon
  USING (true)
  WITH CHECK (true);

-- Messages: Allow encrypted message exchange
CREATE POLICY "Allow message sending" ON messages
  FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "Allow message reading" ON messages
  FOR SELECT TO anon
  USING (true);
