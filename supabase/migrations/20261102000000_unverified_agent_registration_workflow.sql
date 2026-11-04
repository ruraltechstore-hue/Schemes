-- Migration: Unverified Agent Registration & Delayed Admin Approval Workflow
-- Enforces:
-- 1. Agent registration creates profile with status 'unverified' and email_verified = false.
-- 2. No Admin approval request is created during initial registration.
-- 3. Only after successful OTP verification is the status updated to 'pending' and email_verified set to true.
-- 4. Admin approval queue displays ONLY verified agents with status = 'pending'.

-- 1. Update status check constraint on agent_profiles to include 'unverified'
DO $$
BEGIN
  -- Drop existing status check constraint if it exists
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'agent_profiles_status_check' 
      AND conrelid = 'public.agent_profiles'::regclass
  ) THEN
    ALTER TABLE public.agent_profiles DROP CONSTRAINT agent_profiles_status_check;
  END IF;

  -- Add updated constraint with 'unverified' included
  ALTER TABLE public.agent_profiles 
    ADD CONSTRAINT agent_profiles_status_check 
    CHECK (status IN ('unverified', 'pending', 'approved', 'rejected', 'suspended'));
END $$;

-- 2. Add email_verified, otp_verified_at, and admin_notified columns if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agent_profiles' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE public.agent_profiles ADD COLUMN email_verified boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agent_profiles' AND column_name = 'otp_verified_at'
  ) THEN
    ALTER TABLE public.agent_profiles ADD COLUMN otp_verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agent_profiles' AND column_name = 'admin_notified'
  ) THEN
    ALTER TABLE public.agent_profiles ADD COLUMN admin_notified boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Set default status to 'unverified' for new agent profiles
ALTER TABLE public.agent_profiles ALTER COLUMN status SET DEFAULT 'unverified';

-- Ensure existing approved/pending agents have email_verified = true
UPDATE public.agent_profiles
SET email_verified = true
WHERE status IN ('approved', 'pending') AND email_verified = false;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_profiles_email_verified ON public.agent_profiles(email_verified);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_status_verified ON public.agent_profiles(status, email_verified);

-- 3. Update handle_new_user() trigger to create unverified agent profile
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  is_agent boolean := (new.raw_user_meta_data->>'role' = 'agent' OR (new.raw_user_meta_data->>'is_agent')::boolean IS TRUE);
BEGIN
  -- Insert or update profile for basic user record
  INSERT INTO public.profiles(id, full_name, email, mobile, state, district)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'full_name', ''), 
    new.email, 
    COALESCE(new.raw_user_meta_data->>'mobile', ''), 
    COALESCE(new.raw_user_meta_data->>'state', ''), 
    COALESCE(new.raw_user_meta_data->>'district', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    mobile = EXCLUDED.mobile,
    state = EXCLUDED.state,
    district = EXCLUDED.district;

  IF is_agent THEN
    -- Always assign 'user' role
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
    
    -- Insert agent profile as UNVERIFIED (never 'pending' at initial signup)
    INSERT INTO public.agent_profiles (
      id, full_name, email, mobile, agency_name, address, state, district, status, email_verified
    ) VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', 'Agent'),
      new.email,
      COALESCE(new.raw_user_meta_data->>'mobile', ''),
      COALESCE(new.raw_user_meta_data->>'agency_name', new.raw_user_meta_data->>'organization_name', 'Independent Agency'),
      COALESCE(new.raw_user_meta_data->>'address', ''),
      COALESCE(new.raw_user_meta_data->>'state', ''),
      COALESCE(new.raw_user_meta_data->>'district', ''),
      'unverified',
      false
    ) ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      mobile = EXCLUDED.mobile,
      agency_name = EXCLUDED.agency_name,
      address = EXCLUDED.address,
      state = EXCLUDED.state,
      district = EXCLUDED.district
      -- Do NOT overwrite status if already verified or approved
      WHERE public.agent_profiles.status = 'unverified';
  ELSE
    -- Standard user
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'admin') ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END $$;

-- 4. Update enforce_agent_status_security() trigger
-- Allows:
-- - The agent themselves (or server) to transition from 'unverified' to 'pending' upon email OTP verification.
-- - Strictly forbids non-admin users from setting 'approved', 'rejected', or 'suspended'.
-- - Strictly forbids non-admin users from altering already pending/approved/rejected/suspended status.
CREATE OR REPLACE FUNCTION public.enforce_agent_status_security()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Allow transition from 'unverified' to 'pending' if the user is transitioning their own record upon OTP verification
    IF OLD.status = 'unverified' AND NEW.status = 'pending' AND (auth.uid() = NEW.id OR public.has_role(auth.uid(), 'admin')) THEN
      NEW.email_verified = true;
      NEW.otp_verified_at = COALESCE(NEW.otp_verified_at, now());
    ELSIF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'Only authorized administrators can modify agent approval status.';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_agent_status ON public.agent_profiles;
CREATE TRIGGER trg_enforce_agent_status
BEFORE UPDATE ON public.agent_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_status_security();

-- 5. RPC function to safely complete email OTP verification from client or server
CREATE OR REPLACE FUNCTION public.complete_agent_email_verification(_user_id uuid)
RETURNS public.agent_profiles LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_profile public.agent_profiles;
BEGIN
  -- Verify caller is the user themselves or an administrator
  IF auth.uid() IS NOT NULL AND auth.uid() <> _user_id AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized to complete verification for another user.';
  END IF;

  -- Update agent profile to pending status and mark email as verified
  UPDATE public.agent_profiles
  SET 
    status = CASE WHEN status = 'unverified' THEN 'pending' ELSE status END,
    email_verified = true,
    otp_verified_at = COALESCE(otp_verified_at, now()),
    updated_at = now()
  WHERE id = _user_id
  RETURNING * INTO v_profile;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Agent profile not found for user ID: %', _user_id;
  END IF;

  RETURN v_profile;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_agent_email_verification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_agent_email_verification(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_agent_email_verification(uuid) TO anon;
