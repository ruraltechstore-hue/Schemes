export const SUBADMIN_MIGRATION_SQL = `-- Migration: Dynamic Sub-Admin Management and Agent Approval Routing System

-- 1. Ensure 'sub_admin' exists in public.app_role enum
DO $$
BEGIN
  ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sub_admin';
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 2. Define equality operators between text and app_role so comparisons never fail
CREATE OR REPLACE FUNCTION public.app_role_eq_text(public.app_role, text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT $1::text = $2; $$;

CREATE OR REPLACE FUNCTION public.text_eq_app_role(text, public.app_role)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT $1 = $2::text; $$;

DO $$
BEGIN
  CREATE OPERATOR public.= (
    LEFTARG = public.app_role,
    RIGHTARG = text,
    PROCEDURE = public.app_role_eq_text,
    COMMUTATOR = =
  );
EXCEPTION WHEN duplicate_function OR duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  CREATE OPERATOR public.= (
    LEFTARG = text,
    RIGHTARG = public.app_role,
    PROCEDURE = public.text_eq_app_role,
    COMMUTATOR = =
  );
EXCEPTION WHEN duplicate_function OR duplicate_object THEN
  NULL;
END $$;

-- 3. Safely restore user_roles.role type to app_role (now that sub_admin is committed in the enum)
DO $$
BEGIN
  ALTER TABLE public.user_roles ALTER COLUMN role TYPE public.app_role USING role::public.app_role;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 4. Replace has_role with safe implementations for both app_role and text
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = _role::text
  );
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = _role::text
  );
$$;

-- 5. Helper Function: is_approved_agent (Safe against operator type mismatch)
CREATE OR REPLACE FUNCTION public.is_approved_agent(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.agent_profiles
    WHERE id = _user_id AND status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'admin'
  );
$$;

-- 6. Create sub_admin_profiles table
CREATE TABLE IF NOT EXISTS public.sub_admin_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  mobile text NOT NULL,
  organization_name text NOT NULL,
  designation text NOT NULL,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sub_admin_profiles_org ON public.sub_admin_profiles(organization_name);
CREATE INDEX IF NOT EXISTS idx_sub_admin_profiles_active ON public.sub_admin_profiles(is_active);
CREATE INDEX IF NOT EXISTS idx_sub_admin_profiles_email ON public.sub_admin_profiles(email);

ALTER TABLE public.sub_admin_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sub_admin_profiles TO authenticated;
GRANT SELECT ON public.sub_admin_profiles TO anon;
GRANT ALL ON public.sub_admin_profiles TO service_role;

-- 7. Add sub_admin_id to agent_profiles if not present
ALTER TABLE public.agent_profiles ADD COLUMN IF NOT EXISTS sub_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_profiles_sub_admin ON public.agent_profiles(sub_admin_id);

-- 8. Create agent_approval_history table
CREATE TABLE IF NOT EXISTS public.agent_approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES public.agent_profiles(id) ON DELETE CASCADE,
  sub_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'suspended', 'reactivated', 'reassigned')),
  previous_status text,
  new_status text,
  reason text,
  actioned_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_approval_history_agent ON public.agent_approval_history(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_approval_history_sub_admin ON public.agent_approval_history(sub_admin_id);

ALTER TABLE public.agent_approval_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.agent_approval_history TO authenticated;
GRANT ALL ON public.agent_approval_history TO service_role;

-- 9. Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'agent_approval',
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, is_read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

-- 10. Helper function: is_sub_admin (Safe against 55P04 enum transaction issues)
CREATE OR REPLACE FUNCTION public.is_sub_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.sub_admin_profiles sap
    WHERE sap.id = _user_id AND sap.is_active = true
  );
$$;

-- 11. RLS Policies for sub_admin_profiles
DROP POLICY IF EXISTS "anyone can view active sub-admins" ON public.sub_admin_profiles;
CREATE POLICY "anyone can view active sub-admins" ON public.sub_admin_profiles
FOR SELECT TO authenticated
USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR id = auth.uid());

DROP POLICY IF EXISTS "public can view active sub-admins" ON public.sub_admin_profiles;
CREATE POLICY "public can view active sub-admins" ON public.sub_admin_profiles
FOR SELECT TO anon
USING (is_active = true);

DROP POLICY IF EXISTS "main admin sub_admin_profiles all" ON public.sub_admin_profiles;
CREATE POLICY "main admin sub_admin_profiles all" ON public.sub_admin_profiles
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "sub_admin update own profile" ON public.sub_admin_profiles;
CREATE POLICY "sub_admin update own profile" ON public.sub_admin_profiles
FOR UPDATE TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- 12. Update RLS policies for agent_profiles
DROP POLICY IF EXISTS "admin agent_profiles select" ON public.agent_profiles;
CREATE POLICY "admin agent_profiles select" ON public.agent_profiles
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.is_sub_admin(auth.uid()) AND sub_admin_id = auth.uid())
  OR id = auth.uid()
);

DROP POLICY IF EXISTS "admin agent_profiles update" ON public.agent_profiles;
CREATE POLICY "admin agent_profiles update" ON public.agent_profiles
FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.is_sub_admin(auth.uid()) AND sub_admin_id = auth.uid())
  OR id = auth.uid()
);

-- Update trigger enforce_agent_status_security
CREATE OR REPLACE FUNCTION public.enforce_agent_status_security()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'admin');
  v_is_sub_admin boolean := public.is_sub_admin(auth.uid());
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    -- Allow transition from 'unverified' to 'pending' if the user is transitioning their own record upon OTP verification
    IF OLD.status = 'unverified' AND NEW.status = 'pending' AND (auth.uid() = NEW.id OR v_is_admin) THEN
      NEW.email_verified = true;
      NEW.otp_verified_at = COALESCE(NEW.otp_verified_at, now());
    ELSIF v_is_admin THEN
      -- Main Admin can change any status
      NULL;
    ELSIF v_is_sub_admin AND OLD.sub_admin_id = auth.uid() THEN
      -- Assigned Sub-Admin can approve/reject/suspend/reactivate their assigned agent
      NEW.reviewed_by = auth.uid();
      NEW.reviewed_at = now();
    ELSE
      RAISE EXCEPTION 'Only authorized administrators or assigned sub-admins can modify agent approval status.';
    END IF;
  END IF;

  -- Ensure only Main Admin can reassign an agent
  IF OLD.sub_admin_id IS DISTINCT FROM NEW.sub_admin_id AND OLD.sub_admin_id IS NOT NULL THEN
    IF NOT v_is_admin THEN
      RAISE EXCEPTION 'Only Main Admin can reassign an agent to another Sub-Admin.';
    END IF;
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_agent_status_security ON public.agent_profiles;
CREATE TRIGGER trigger_enforce_agent_status_security
BEFORE UPDATE ON public.agent_profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_agent_status_security();

-- 13. Update managed_users RLS so Sub-Admin can view beneficiaries of their assigned agents
DROP POLICY IF EXISTS "approved agent managed_users select" ON public.managed_users;
CREATE POLICY "approved agent managed_users select" ON public.managed_users 
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
  OR (
    public.is_sub_admin(auth.uid()) 
    AND EXISTS (
      SELECT 1 FROM public.agent_profiles ap 
      WHERE ap.id = managed_users.agent_id AND ap.sub_admin_id = auth.uid()
    )
  )
);

-- Ensure approved agent managed_users insert policy uses updated helper
DROP POLICY IF EXISTS "approved agent managed_users insert" ON public.managed_users;
CREATE POLICY "approved agent managed_users insert" ON public.managed_users 
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

DROP POLICY IF EXISTS "approved agent managed_users update" ON public.managed_users;
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

DROP POLICY IF EXISTS "approved agent managed_users delete" ON public.managed_users;
CREATE POLICY "approved agent managed_users delete" ON public.managed_users 
FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(), 'admin') 
  OR (agent_id = auth.uid() AND public.is_approved_agent(auth.uid()))
);

-- 14. Notifications RLS
DROP POLICY IF EXISTS "users manage own notifications" ON public.notifications;
CREATE POLICY "users manage own notifications" ON public.notifications
FOR ALL TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- 15. Approval history RLS
DROP POLICY IF EXISTS "approval history select" ON public.agent_approval_history;
CREATE POLICY "approval history select" ON public.agent_approval_history
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (public.is_sub_admin(auth.uid()) AND (sub_admin_id = auth.uid() OR actioned_by = auth.uid()))
  OR agent_id = auth.uid()
);

DROP POLICY IF EXISTS "approval history insert" ON public.agent_approval_history;
CREATE POLICY "approval history insert" ON public.agent_approval_history
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (public.is_sub_admin(auth.uid()) AND actioned_by = auth.uid())
);

-- 16. Immediate Sub-Admin Activation & Email Confirmation (No OTP required for Sub-Admins)
CREATE OR REPLACE FUNCTION public.handle_sub_admin_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  -- Auto-confirm the user's email in auth.users immediately
  UPDATE auth.users
  SET email_confirmed_at = COALESCE(email_confirmed_at, now())
  WHERE id = NEW.id;

  -- Ensure role 'sub_admin' is assigned in user_roles
  BEGIN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'sub_admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'sub_admin')
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_on_sub_admin_profile_created ON public.sub_admin_profiles;
CREATE TRIGGER trigger_on_sub_admin_profile_created
AFTER INSERT OR UPDATE ON public.sub_admin_profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_sub_admin_created();

-- Backfill: Activate and confirm any existing Sub-Admin accounts in auth.users
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE id IN (SELECT id FROM public.sub_admin_profiles)
   OR raw_user_meta_data->>'role' = 'sub_admin';

-- Rescue any sub-admin users created in auth.users whose profile insert failed previously
INSERT INTO public.sub_admin_profiles (
  id,
  full_name,
  email,
  mobile,
  organization_name,
  designation,
  is_active
)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', 'Sub Admin'),
  email,
  COALESCE(raw_user_meta_data->>'mobile', ''),
  COALESCE(raw_user_meta_data->>'organization_name', 'Organization'),
  COALESCE(raw_user_meta_data->>'designation', 'Sub-Admin'),
  true
FROM auth.users
WHERE (raw_user_meta_data->>'role' = 'sub_admin')
  AND id NOT IN (SELECT id FROM public.sub_admin_profiles)
  AND email NOT IN (SELECT email FROM public.sub_admin_profiles WHERE email IS NOT NULL)
ON CONFLICT (id) DO NOTHING;

-- RPC helper for client to confirm active sub-admin without exposing admin keys
CREATE OR REPLACE FUNCTION public.confirm_sub_admin_email(_email text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
DECLARE
  v_sub_admin_id uuid;
BEGIN
  SELECT id INTO v_sub_admin_id
  FROM public.sub_admin_profiles
  WHERE lower(trim(email)) = lower(trim(_email)) AND is_active = true;

  IF v_sub_admin_id IS NOT NULL THEN
    UPDATE auth.users
    SET email_confirmed_at = COALESCE(email_confirmed_at, now())
    WHERE id = v_sub_admin_id;

    BEGIN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (v_sub_admin_id, 'sub_admin'::public.app_role)
      ON CONFLICT (user_id, role) DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_sub_admin_id, 'sub_admin')
        ON CONFLICT DO NOTHING;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END;

    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_sub_admin_email(text) TO anon, authenticated;

-- Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
`;
