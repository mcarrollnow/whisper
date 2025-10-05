-- Privacy-focused schema for anonymous messaging
-- Removes email requirements and implements Signal-like privacy

-- Drop existing tables if recreating
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS user_keys CASCADE;

-- Create users table with anonymous usernames (no email required)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL, -- Anonymous username like @whisper.42
  display_name TEXT, -- Optional display name user can set
  password_hash TEXT NOT NULL, -- Hashed password for authentication
  identity_key TEXT DEFAULT '',
  signed_pre_key TEXT DEFAULT '',
  pre_key_signature TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create user_keys table for additional key management
CREATE TABLE user_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_type TEXT NOT NULL, -- 'identity', 'signed_prekey', 'onetime_prekey'
  key_data TEXT NOT NULL,
  key_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create messages table (unchanged for encryption)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create username generation function
CREATE OR REPLACE FUNCTION generate_anonymous_username()
RETURNS TEXT AS $$
DECLARE
  username TEXT;
  counter INTEGER := 0;
BEGIN
  LOOP
    -- Generate username like @whisper.42 or @secure.1337
    username := '@' || 
      (ARRAY['whisper', 'secure', 'private', 'anon', 'ghost', 'shadow', 'cipher', 'vault'])[floor(random() * 8 + 1)] ||
      '.' || 
      floor(random() * 9999 + 1)::TEXT;
    
    -- Check if username already exists
    IF NOT EXISTS (SELECT 1 FROM users WHERE users.username = username) THEN
      RETURN username;
    END IF;
    
    counter := counter + 1;
    -- Prevent infinite loop
    IF counter > 100 THEN
      username := '@user.' || extract(epoch from now())::bigint::TEXT;
      EXIT;
    END IF;
  END LOOP;
  
  RETURN username;
END;
$$ LANGUAGE plpgsql;

-- Disable Row Level Security for custom authentication
-- We'll handle security at the application level since we're not using Supabase Auth
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_keys DISABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX users_username_idx ON users(username);
CREATE INDEX users_display_name_idx ON users(display_name);
CREATE INDEX messages_sender_id_idx ON messages(sender_id);
CREATE INDEX messages_recipient_id_idx ON messages(recipient_id);
CREATE INDEX messages_created_at_idx ON messages(created_at DESC);
CREATE INDEX user_keys_user_id_idx ON user_keys(user_id);
CREATE INDEX user_keys_type_idx ON user_keys(key_type);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = TIMEZONE('utc', NOW());
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for users table
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Create function to update last_seen
CREATE OR REPLACE FUNCTION update_last_seen()
RETURNS TRIGGER AS $$
BEGIN
   NEW.last_seen = TIMEZONE('utc', NOW());
   RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update last_seen on any user activity
CREATE TRIGGER update_users_last_seen
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_last_seen();
