-- Migration: Individual User Documents and Scheme Eligibility
-- Supports individual beneficiary document management, RLS policies, and eligibility tracking

-- 1. Add managed_user_id, agent_id, and scheme_id columns to public.documents if they do not exist
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS managed_user_id uuid REFERENCES public.managed_users(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS agent_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS scheme_id uuid REFERENCES public.schemes(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_managed_user ON public.documents(managed_user_id);
CREATE INDEX IF NOT EXISTS idx_documents_agent ON public.documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_documents_scheme ON public.documents(scheme_id);

-- 2. Add managed_user_id and summary to public.eligibility_check_history
ALTER TABLE public.eligibility_check_history ADD COLUMN IF NOT EXISTS managed_user_id uuid REFERENCES public.managed_users(id) ON DELETE CASCADE;
ALTER TABLE public.eligibility_check_history ADD COLUMN IF NOT EXISTS summary jsonb DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_eligibility_check_managed_user ON public.eligibility_check_history(managed_user_id);

-- 3. Update Row Level Security (RLS) on public.documents
-- Admins have full access to all documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'admin documents all'
  ) THEN
    CREATE POLICY "admin documents all" ON public.documents FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

-- Approved agents can select documents belonging to them or their managed users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'approved agent documents select'
  ) THEN
    CREATE POLICY "approved agent documents select" ON public.documents FOR SELECT TO authenticated
    USING (
      user_id = auth.uid() 
      OR agent_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.managed_users mu 
        WHERE mu.id = documents.managed_user_id AND mu.agent_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Approved agents can insert documents for their managed users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'approved agent documents insert'
  ) THEN
    CREATE POLICY "approved agent documents insert" ON public.documents FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid()
      OR agent_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.managed_users mu 
        WHERE mu.id = managed_user_id AND mu.agent_id = auth.uid()
      )
    );
  END IF;
END $$;

-- Approved agents can delete documents for their managed users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'documents' AND policyname = 'approved agent documents delete'
  ) THEN
    CREATE POLICY "approved agent documents delete" ON public.documents FOR DELETE TO authenticated
    USING (
      user_id = auth.uid()
      OR agent_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.managed_users mu 
        WHERE mu.id = documents.managed_user_id AND mu.agent_id = auth.uid()
      )
    );
  END IF;
END $$;

-- 4. Storage policies for private documents bucket
-- Ensure agents can store and manage beneficiary files under their user id prefix
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'agents manage beneficiary files'
  ) THEN
    CREATE POLICY "agents manage beneficiary files" ON storage.objects FOR ALL TO authenticated
    USING (
      bucket_id = 'documents' 
      AND (
        (storage.foldername(name))[1] = auth.uid()::text 
        OR public.has_role(auth.uid(), 'admin')
      )
    )
    WITH CHECK (
      bucket_id = 'documents' 
      AND (
        (storage.foldername(name))[1] = auth.uid()::text 
        OR public.has_role(auth.uid(), 'admin')
      )
    );
  END IF;
END $$;
