-- Migration: Support Admin Profile Avatar and Profiles avatar_url
-- Description:
-- 1. Adds avatar_url column to public.profiles if not exists
-- 2. Profile photos are stored in the existing 'documents' storage bucket under {user_id}/avatars/
--    which already has RLS policies enforcing user isolation: (storage.foldername(name))[1] = auth.uid()::text

ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS avatar_url text;
