-- Fix ambiguous column reference in invite code functions
-- Run this in Supabase SQL Editor

-- Drop and recreate the functions with fixed column references
DROP FUNCTION IF EXISTS generate_invite_code();
DROP FUNCTION IF EXISTS create_invite_code(UUID);
DROP FUNCTION IF EXISTS use_invite_code(TEXT, UUID);

-- Function to generate secure invite code (fixed)
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  generated_code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    generated_code := upper(substring(encode(gen_random_bytes(6), 'base64') from 1 for 8));
    
    -- Remove confusing characters
    generated_code := replace(generated_code, '0', 'A');
    generated_code := replace(generated_code, 'O', 'B');
    generated_code := replace(generated_code, 'I', 'C');
    generated_code := replace(generated_code, 'L', 'D');
    generated_code := replace(generated_code, '1', 'E');
    generated_code := replace(generated_code, '+', 'F');
    generated_code := replace(generated_code, '/', 'G');
    generated_code := replace(generated_code, '=', 'H');
    
    -- Check if code already exists (fixed column reference)
    SELECT EXISTS(
      SELECT 1 FROM invite_codes 
      WHERE invite_codes.code = generated_code 
        AND invite_codes.used = FALSE 
        AND invite_codes.expires_at > NOW()
    ) INTO exists_check;
    
    IF NOT exists_check THEN
      RETURN generated_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create invite code (fixed)
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

-- Function to use invite code and add contact (fixed)
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
