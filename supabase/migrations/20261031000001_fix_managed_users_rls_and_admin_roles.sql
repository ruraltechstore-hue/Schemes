-- ==============================================================================
-- FIX FOR "new row violates row-level security policy for table managed_users"
-- ==============================================================================
-- 1. Helper Function: is_approved_agent
-- Returns TRUE if the user is an approved agent OR an administrator.
CREATE OR REPLACE FUNCTION public.is_approved_agent(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE id = _user_id AND status = 'approved'
  ) OR public.has_role(_user_id, 'admin');
$$;

-- 2. Clean up and recreate managed_users RLS policies
ALTER TABLE public.managed_users ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.managed_users TO authenticated;
GRANT ALL ON public.managed_users TO service_role;

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

-- Approved agents and administrators can select managed users
CREATE POLICY "approved agent managed_users select" ON public.managed_users 
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- Approved agents and administrators can insert managed users
CREATE POLICY "approved agent managed_users insert" ON public.managed_users 
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- Approved agents and administrators can update managed users
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

-- Approved agents and administrators can delete managed users
CREATE POLICY "approved agent managed_users delete" ON public.managed_users 
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- 3. Fix policies on eligibility_check_history and user_scheme_matches
DROP POLICY IF EXISTS "admin check_history all" ON public.eligibility_check_history;
DROP POLICY IF EXISTS "approved agent check_history select" ON public.eligibility_check_history;
DROP POLICY IF EXISTS "approved agent check_history insert" ON public.eligibility_check_history;

CREATE POLICY "admin check_history all" ON public.eligibility_check_history 
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "approved agent check_history select" ON public.eligibility_check_history 
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

CREATE POLICY "approved agent check_history insert" ON public.eligibility_check_history 
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- 4. Backfill: Grant 'admin' role to admin@test.com and seed approved agent profile
DO $$
DECLARE
  adm_record RECORD;
  usr_record RECORD;
BEGIN
  -- 4.1 Ensure admin accounts have 'admin' role in user_roles and approved agent profile
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

  -- 4.2 Seed user@test.com as an approved test agent for immediate local development
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
