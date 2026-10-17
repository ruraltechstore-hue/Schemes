DO $$
DECLARE
  admin_id UUID := gen_random_uuid();
  user_id UUID := gen_random_uuid();
BEGIN
  -- Insert Admin
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', admin_id, 'authenticated', 'authenticated', 'admin@test.com', 
    crypt('password123', gen_salt('bf')), current_timestamp, 
    '{"provider":"email","providers":["email"]}', '{"full_name":"Test Admin","mobile":"9999999999","state":"Delhi","district":"New Delhi"}', current_timestamp, current_timestamp,
    '', '', '', ''
  );
  
  -- Insert User
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated', 'user@test.com', 
    crypt('password123', gen_salt('bf')), current_timestamp, 
    '{"provider":"email","providers":["email"]}', '{"full_name":"Test User","mobile":"8888888888","state":"Maharashtra","district":"Mumbai"}', current_timestamp, current_timestamp,
    '', '', '', ''
  );

  -- Insert Auth Identities
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), admin_id, admin_id::text, format('{"sub":"%s","email":"%s"}', admin_id::text, 'admin@test.com')::jsonb, 'email', current_timestamp, current_timestamp, current_timestamp
  );

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), user_id, user_id::text, format('{"sub":"%s","email":"%s"}', user_id::text, 'user@test.com')::jsonb, 'email', current_timestamp, current_timestamp, current_timestamp
  );
END $$;
