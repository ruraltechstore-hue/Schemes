-- Migration: Scheme Compass Agent Approval System and Multi-User Management
-- Creates agent_profiles, managed_users, eligibility_check_history, user_scheme_matches
-- Configures Row Level Security (RLS) policies and security triggers

-- 1. Ensure 'agent' value exists in public.app_role enum if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'app_role' AND e.enumlabel = 'agent'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent';
  END IF;
END $$;

-- 2. Create agent_profiles table
CREATE TABLE IF NOT EXISTS public.agent_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  mobile text NOT NULL,
  agency_name text NOT NULL,
  address text NOT NULL,
  state text NOT NULL,
  district text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  rejection_reason text,
  suspension_reason text,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_profiles_status ON public.agent_profiles(status);
CREATE INDEX IF NOT EXISTS idx_agent_profiles_email ON public.agent_profiles(email);

ALTER TABLE public.agent_profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.agent_profiles TO authenticated;
GRANT ALL ON public.agent_profiles TO service_role;

-- Helper function: is_approved_agent (returns true for approved agents or administrators)
CREATE OR REPLACE FUNCTION public.is_approved_agent(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE id = _user_id AND status = 'approved'
  ) OR public.has_role(_user_id, 'admin');
$$;

-- RLS Policies on agent_profiles
-- Admins can view all agent profiles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_profiles' AND policyname = 'admin agent_profiles select') THEN
    CREATE POLICY "admin agent_profiles select" ON public.agent_profiles FOR SELECT TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Agents can view their own profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_profiles' AND policyname = 'own agent_profiles select') THEN
    CREATE POLICY "own agent_profiles select" ON public.agent_profiles FOR SELECT TO authenticated
    USING (id = auth.uid());
  END IF;
END $$;

-- Users can insert their own profile upon registration (status defaults to pending)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_profiles' AND policyname = 'agent_profiles insert') THEN
    CREATE POLICY "agent_profiles insert" ON public.agent_profiles FOR INSERT TO authenticated
    WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Admins can update any agent profile (including status changes)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_profiles' AND policyname = 'admin agent_profiles update') THEN
    CREATE POLICY "admin agent_profiles update" ON public.agent_profiles FOR UPDATE TO authenticated
    USING (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Agents can update their own agent profile
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'agent_profiles' AND policyname = 'own agent_profiles update') THEN
    CREATE POLICY "own agent_profiles update" ON public.agent_profiles FOR UPDATE TO authenticated
    USING (id = auth.uid());
  END IF;
END $$;

-- Security Trigger: Prevent non-admin users from changing their own or other agent's status
CREATE OR REPLACE FUNCTION public.enforce_agent_status_security()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
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

-- 3. Create managed_users table (beneficiary records managed by agents)
CREATE TABLE IF NOT EXISTS public.managed_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  dob date,
  age int,
  gender text NOT NULL,
  mobile text,
  email text,
  state text NOT NULL,
  district text NOT NULL,
  area text DEFAULT 'Rural',
  annual_income numeric DEFAULT 0,
  occupation text,
  education text,
  category text DEFAULT 'General',
  has_disability boolean DEFAULT false,
  disability_percentage int,
  is_farmer boolean DEFAULT false,
  is_student boolean DEFAULT false,
  marital_status text,
  family_size int DEFAULT 1,
  extra_criteria jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_managed_users_agent ON public.managed_users(agent_id);
CREATE INDEX IF NOT EXISTS idx_managed_users_name ON public.managed_users(full_name);
CREATE INDEX IF NOT EXISTS idx_managed_users_mobile ON public.managed_users(mobile);

ALTER TABLE public.managed_users ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.managed_users TO authenticated;
GRANT ALL ON public.managed_users TO service_role;

-- Policies for managed_users
DROP POLICY IF EXISTS "admin managed_users all" ON public.managed_users;
DROP POLICY IF EXISTS "approved agent managed_users select" ON public.managed_users;
DROP POLICY IF EXISTS "approved agent managed_users insert" ON public.managed_users;
DROP POLICY IF EXISTS "approved agent managed_users update" ON public.managed_users;
DROP POLICY IF EXISTS "approved agent managed_users delete" ON public.managed_users;

-- Admins have full access to all managed users
CREATE POLICY "admin managed_users all" ON public.managed_users 
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Approved agents can select only their own managed users (admins can view all)
CREATE POLICY "approved agent managed_users select" ON public.managed_users 
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- Approved agents can insert their own managed users (admins can insert for their id)
CREATE POLICY "approved agent managed_users insert" ON public.managed_users 
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- Approved agents can update their own managed users (admins can update any)
CREATE POLICY "approved agent managed_users update" ON public.managed_users 
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- Approved agents can delete their own managed users (admins can delete any)
CREATE POLICY "approved agent managed_users delete" ON public.managed_users 
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- 4. Create eligibility_check_history table
CREATE TABLE IF NOT EXISTS public.eligibility_check_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  batch_id text,
  check_type text NOT NULL DEFAULT 'individual',
  total_users int NOT NULL DEFAULT 1,
  total_schemes_checked int NOT NULL DEFAULT 0,
  total_eligible_matches int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eligibility_check_history_agent ON public.eligibility_check_history(agent_id);

ALTER TABLE public.eligibility_check_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.eligibility_check_history TO authenticated;
GRANT ALL ON public.eligibility_check_history TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'eligibility_check_history' AND policyname = 'admin check_history all') THEN
    CREATE POLICY "admin check_history all" ON public.eligibility_check_history FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'eligibility_check_history' AND policyname = 'approved agent check_history select') THEN
    CREATE POLICY "approved agent check_history select" ON public.eligibility_check_history FOR SELECT TO authenticated
    USING (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'eligibility_check_history' AND policyname = 'approved agent check_history insert') THEN
    CREATE POLICY "approved agent check_history insert" ON public.eligibility_check_history FOR INSERT TO authenticated
    WITH CHECK (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()));
  END IF;
END $$;

-- 5. Create user_scheme_matches table
CREATE TABLE IF NOT EXISTS public.user_scheme_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid REFERENCES public.eligibility_check_history(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES public.managed_users(id) ON DELETE CASCADE,
  scheme_id uuid NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('eligible', 'ineligible', 'needs_verification')),
  match_percentage int NOT NULL DEFAULT 0,
  reasons text[] NOT NULL DEFAULT '{}',
  missing_criteria text[] NOT NULL DEFAULT '{}',
  missing_documents text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, scheme_id)
);

CREATE INDEX IF NOT EXISTS idx_user_scheme_matches_user ON public.user_scheme_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_scheme_matches_scheme ON public.user_scheme_matches(scheme_id);
CREATE INDEX IF NOT EXISTS idx_user_scheme_matches_agent ON public.user_scheme_matches(agent_id);

ALTER TABLE public.user_scheme_matches ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_scheme_matches TO authenticated;
GRANT ALL ON public.user_scheme_matches TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scheme_matches' AND policyname = 'admin user_scheme_matches all') THEN
    CREATE POLICY "admin user_scheme_matches all" ON public.user_scheme_matches FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scheme_matches' AND policyname = 'approved agent user_scheme_matches select') THEN
    CREATE POLICY "approved agent user_scheme_matches select" ON public.user_scheme_matches FOR SELECT TO authenticated
    USING (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scheme_matches' AND policyname = 'approved agent user_scheme_matches insert') THEN
    CREATE POLICY "approved agent user_scheme_matches insert" ON public.user_scheme_matches FOR INSERT TO authenticated
    WITH CHECK (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scheme_matches' AND policyname = 'approved agent user_scheme_matches update') THEN
    CREATE POLICY "approved agent user_scheme_matches update" ON public.user_scheme_matches FOR UPDATE TO authenticated
    USING (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
    WITH CHECK (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_scheme_matches' AND policyname = 'approved agent user_scheme_matches delete') THEN
    CREATE POLICY "approved agent user_scheme_matches delete" ON public.user_scheme_matches FOR DELETE TO authenticated
    USING (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()));
  END IF;
END $$;

-- 6. Update handle_new_user to handle agent registration safely
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  is_agent boolean := (new.raw_user_meta_data->>'role' = 'agent' OR (new.raw_user_meta_data->>'is_agent')::boolean IS TRUE);
BEGIN
  -- Insert profile for basic user record
  INSERT INTO public.profiles(id, full_name, email, mobile, state, district)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.email, new.raw_user_meta_data->>'mobile', new.raw_user_meta_data->>'state', new.raw_user_meta_data->>'district')
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    mobile = EXCLUDED.mobile,
    state = EXCLUDED.state,
    district = EXCLUDED.district;

  IF is_agent THEN
    -- Always assign 'user' role, never auto-assign 'admin'
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
    
    -- Insert agent profile with pending status
    INSERT INTO public.agent_profiles (
      id, full_name, email, mobile, agency_name, address, state, district, status
    ) VALUES (
      new.id,
      COALESCE(new.raw_user_meta_data->>'full_name', 'Agent'),
      new.email,
      COALESCE(new.raw_user_meta_data->>'mobile', ''),
      COALESCE(new.raw_user_meta_data->>'agency_name', new.raw_user_meta_data->>'organization_name', 'Independent Agency'),
      COALESCE(new.raw_user_meta_data->>'address', ''),
      COALESCE(new.raw_user_meta_data->>'state', ''),
      COALESCE(new.raw_user_meta_data->>'district', ''),
      'pending'
    ) ON CONFLICT (id) DO NOTHING;
  ELSE
    -- Standard user
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
    IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role='admin') THEN
      INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'admin') ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  RETURN new;
END $$;

-- 7. Ensure administrator account has 'admin' role in user_roles and approved agent profile,
-- and seed test user as an approved test agent
DO $$
DECLARE
  adm_record RECORD;
  usr_record RECORD;
BEGIN
  -- Backfill admin role and approved profile for admin account(s)
  FOR adm_record IN 
    SELECT id, email, raw_user_meta_data 
    FROM auth.users 
    WHERE email = 'admin@test.com' OR email LIKE 'admin@%'
  LOOP
    INSERT INTO public.user_roles (user_id, role)
    VALUES (adm_record.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    INSERT INTO public.agent_profiles (
      id, full_name, email, mobile, agency_name, address, state, district, status
    ) VALUES (
      adm_record.id,
      COALESCE(adm_record.raw_user_meta_data->>'full_name', 'System Administrator'),
      adm_record.email,
      COALESCE(adm_record.raw_user_meta_data->>'mobile', '9999999999'),
      'Scheme Compass Administration',
      'Administrative Headquarters',
      COALESCE(adm_record.raw_user_meta_data->>'state', 'Delhi'),
      COALESCE(adm_record.raw_user_meta_data->>'district', 'New Delhi'),
      'approved'
    )
    ON CONFLICT (id) DO UPDATE SET status = 'approved';
  END LOOP;

  -- Ensure user@test.com also has an approved test agent profile for local development
  FOR usr_record IN 
    SELECT id, email, raw_user_meta_data 
    FROM auth.users 
    WHERE email = 'user@test.com'
  LOOP
    INSERT INTO public.agent_profiles (
      id, full_name, email, mobile, agency_name, address, state, district, status
    ) VALUES (
      usr_record.id,
      COALESCE(usr_record.raw_user_meta_data->>'full_name', 'Test Agent Partner'),
      usr_record.email,
      COALESCE(usr_record.raw_user_meta_data->>'mobile', '8888888888'),
      'Rural Seva Kendra',
      'Civil Lines',
      COALESCE(usr_record.raw_user_meta_data->>'state', 'Maharashtra'),
      COALESCE(usr_record.raw_user_meta_data->>'district', 'Mumbai'),
      'approved'
    )
    ON CONFLICT (id) DO UPDATE SET status = 'approved';
  END LOOP;
END $$;
