-- Migration: Ensure admin can manage applications and safely cascade scheme deletions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'applications' AND policyname = 'admin applications all'
  ) THEN
    CREATE POLICY "admin applications all" ON public.applications FOR ALL TO authenticated
    USING (public.has_role(auth.uid(), 'admin'))
    WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;
