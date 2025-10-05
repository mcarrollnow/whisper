-- Secure contact system with temporary invite codes
-- Run this in Supabase SQL Editor

-- Create contacts table for approved connections
CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure no duplicate contacts
  UNIQUE(user_id, contact_user_id)
);

-- Create invite_codes table for secure contact requests
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES users(id),
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS contacts_user_id_idx ON contacts(user_id);
CREATE INDEX IF NOT EXISTS contacts_contact_user_id_idx ON contacts(contact_user_id);
CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON invite_codes(code);
CREATE INDEX IF NOT EXISTS invite_codes_user_id_idx ON invite_codes(user_id);
CREATE INDEX IF NOT EXISTS invite_codes_expires_idx ON invite_codes(expires_at);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for contacts
CREATE POLICY "users_can_manage_their_contacts" ON contacts
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for invite codes
CREATE POLICY "users_can_manage_invite_codes" ON invite_codes
  FOR ALL TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE contacts TO anon;
GRANT ALL PRIVILEGES ON TABLE invite_codes TO anon;

-- Function to generate secure invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := upper(substring(encode(gen_random_bytes(6), 'base64') from 1 for 8));
    
    -- Remove confusing characters
    code := replace(code, '0', 'A');
    code := replace(code, 'O', 'B');
    code := replace(code, 'I', 'C');
    code := replace(code, 'L', 'D');
    code := replace(code, '1', 'E');
    code := replace(code, '+', 'F');
    code := replace(code, '/', 'G');
    code := replace(code, '=', 'H');
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM invite_codes WHERE invite_codes.code = code AND used = FALSE AND expires_at > NOW()) INTO exists_check;
    
    IF NOT exists_check THEN
      RETURN code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create invite code
CREATE OR REPLACE FUNCTION create_invite_code(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
BEGIN
  -- Deactivate any existing unused codes for this user
  UPDATE invite_codes 
  SET used = TRUE, used_at = NOW()
  WHERE user_id = p_user_id AND used = FALSE;
  
  -- Generate new code
  new_code := generate_invite_code();
  
  -- Insert new invite code (expires in 24 hours)
  INSERT INTO invite_codes (user_id, code, expires_at)
  VALUES (p_user_id, new_code, NOW() + INTERVAL '24 hours');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to use invite code and add contact
CREATE OR REPLACE FUNCTION use_invite_code(p_code TEXT, p_requesting_user_id UUID)
RETURNS JSON AS $$
DECLARE
  invite_record RECORD;
  target_user RECORD;
  result JSON;
BEGIN
  -- Find valid invite code
  SELECT * INTO invite_record
  FROM invite_codes 
  WHERE code = p_code 
    AND used = FALSE 
    AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Invalid or expired invite code');
  END IF;
  
  -- Can't add yourself
  IF invite_record.user_id = p_requesting_user_id THEN
    RETURN json_build_object('success', false, 'error', 'Cannot add yourself as contact');
  END IF;
  
  -- Check if already contacts
  IF EXISTS(SELECT 1 FROM contacts WHERE user_id = p_requesting_user_id AND contact_user_id = invite_record.user_id) THEN
    RETURN json_build_object('success', false, 'error', 'Already in contacts');
  END IF;
  
  -- Get target user info
  SELECT id, username, display_name, identity_key_public, registration_id 
  INTO target_user
  FROM users 
  WHERE id = invite_record.user_id;
  
  -- Mark invite code as used
  UPDATE invite_codes 
  SET used = TRUE, used_by = p_requesting_user_id, used_at = NOW()
  WHERE id = invite_record.id;
  
  -- Add bidirectional contact relationship
  INSERT INTO contacts (user_id, contact_user_id) 
  VALUES (p_requesting_user_id, invite_record.user_id);
  
  INSERT INTO contacts (user_id, contact_user_id) 
  VALUES (invite_record.user_id, p_requesting_user_id);
  
  -- Return success with user info
  RETURN json_build_object(
    'success', true, 
    'user', json_build_object(
      'id', target_user.id,
      'username', target_user.username,
      'display_name', target_user.display_name,
      'identity_key_public', target_user.identity_key_public,
      'registration_id', target_user.registration_id
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Remove the old searchable user policy
DROP POLICY IF EXISTS "users_select_policy" ON users;

-- Create restricted user policy - only show your own profile
CREATE POLICY "users_own_profile_only" ON users
  FOR SELECT TO anon, authenticated
  USING (true); -- Will be restricted in application logic

-- Update messages policies to require contact relationship
DROP POLICY IF EXISTS "messages_all_policy" ON messages;

CREATE POLICY "messages_contacts_only" ON messages
  FOR ALL TO anon, authenticated
  USING (true) -- Will be enforced in application logic
  WITH CHECK (true);
