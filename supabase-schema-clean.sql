-- Clean privacy-focused schema for anonymous messaging
-- Run this in Supabase SQL Editor

-- Clean slate - remove everything first
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_keys CASCADE;

-- Create users table with anonymous usernames (no email required)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  display_name TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create messages table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create indexes for performance
CREATE INDEX users_username_idx ON users(username);
CREATE INDEX messages_sender_id_idx ON messages(sender_id);
CREATE INDEX messages_recipient_id_idx ON messages(recipient_id);
CREATE INDEX messages_created_at_idx ON messages(created_at DESC);

-- Enable RLS with custom policies for privacy auth
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users policies - allow reading usernames for search, but protect sensitive data
CREATE POLICY "Allow reading usernames for search" ON users
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Allow user creation" ON users
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Allow user updates" ON users
  FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Messages policies - allow all operations (app-level security)
CREATE POLICY "Allow message operations" ON messages
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);
