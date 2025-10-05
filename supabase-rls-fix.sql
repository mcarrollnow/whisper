-- Fix RLS policies for Signal Protocol access
-- Run this in Supabase SQL Editor

-- Drop existing policies that might be blocking access
DROP POLICY IF EXISTS "Allow user registration" ON users;
DROP POLICY IF EXISTS "Allow public key lookup" ON users;
DROP POLICY IF EXISTS "Allow profile updates" ON users;
DROP POLICY IF EXISTS "Allow prekey publishing" ON prekeys;
DROP POLICY IF EXISTS "Allow prekey fetching" ON prekeys;
DROP POLICY IF EXISTS "Allow prekey usage marking" ON prekeys;
DROP POLICY IF EXISTS "Allow session creation" ON sessions;
DROP POLICY IF EXISTS "Allow session access" ON sessions;
DROP POLICY IF EXISTS "Allow session updates" ON sessions;
DROP POLICY IF EXISTS "Allow message sending" ON messages;
DROP POLICY IF EXISTS "Allow message reading" ON messages;

-- Create permissive policies for Signal Protocol operations
-- Users table - allow all operations for anon users
CREATE POLICY "users_select_policy" ON users
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "users_insert_policy" ON users
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "users_update_policy" ON users
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Prekeys table - allow all operations
CREATE POLICY "prekeys_all_policy" ON prekeys
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Sessions table - allow all operations
CREATE POLICY "sessions_all_policy" ON sessions
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Messages table - allow all operations
CREATE POLICY "messages_all_policy" ON messages
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Grant explicit permissions to anon role
GRANT ALL PRIVILEGES ON TABLE users TO anon;
GRANT ALL PRIVILEGES ON TABLE prekeys TO anon;
GRANT ALL PRIVILEGES ON TABLE sessions TO anon;
GRANT ALL PRIVILEGES ON TABLE messages TO anon;

-- Grant sequence permissions for UUID generation
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon;
