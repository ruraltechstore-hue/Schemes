-- Migration: Add Application Tutorial Video Support for Government Schemes
-- Description:
-- 1. Adds application_video_url and video_type columns to schemes table
-- 2. Creates the public 'scheme-videos' storage bucket with 100MB limit and MP4/WebM/MOV mime types
-- 3. Configures RLS policies: public read for all visitors, admin write/update/delete

-- Step 1: Add video columns to public.schemes
ALTER TABLE public.schemes 
  ADD COLUMN IF NOT EXISTS application_video_url text,
  ADD COLUMN IF NOT EXISTS video_type text;

-- Step 2: Create public 'scheme-videos' bucket for scheme tutorial videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scheme-videos',
  'scheme-videos',
  true,
  104857600, -- 100 MB limit
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/mp4', 'video/webm', 'video/quicktime'];

-- Step 3: Storage Object RLS Policies for 'scheme-videos'

-- Allow public read access to all users (authenticated and anonymous) to view scheme videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'scheme videos public read'
  ) THEN
    CREATE POLICY "scheme videos public read" 
      ON storage.objects FOR SELECT 
      USING (bucket_id = 'scheme-videos');
  END IF;
END $$;

-- Allow only authorized administrators to upload tutorial videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'scheme videos admin insert'
  ) THEN
    CREATE POLICY "scheme videos admin insert" 
      ON storage.objects FOR INSERT 
      TO authenticated 
      WITH CHECK (
        bucket_id = 'scheme-videos' 
        AND public.has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;

-- Allow authorized administrators to update existing tutorial videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'scheme videos admin update'
  ) THEN
    CREATE POLICY "scheme videos admin update" 
      ON storage.objects FOR UPDATE 
      TO authenticated 
      USING (
        bucket_id = 'scheme-videos' 
        AND public.has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;

-- Allow authorized administrators to delete tutorial videos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'scheme videos admin delete'
  ) THEN
    CREATE POLICY "scheme videos admin delete" 
      ON storage.objects FOR DELETE 
      TO authenticated 
      USING (
        bucket_id = 'scheme-videos' 
        AND public.has_role(auth.uid(), 'admin')
      );
  END IF;
END $$;
