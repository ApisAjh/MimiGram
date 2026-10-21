-- MimiGram Storage: bucket + policies
-- Run this in Supabase SQL Editor (or apply after 001 + 002)

-- 1) Create public media bucket (50MB, images + video)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media',
  'media',
  true,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2) Policies on storage.objects
-- Public read (feed/reels need to load media in browser)
DROP POLICY IF EXISTS "Public media read" ON storage.objects;
CREATE POLICY "Public media read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'media');

-- Allow uploads via signed URL / service role path
-- Service role bypasses RLS; these policies help if using anon key client
DROP POLICY IF EXISTS "Public media insert" ON storage.objects;
CREATE POLICY "Public media insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Public media update" ON storage.objects;
CREATE POLICY "Public media update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Public media delete" ON storage.objects;
CREATE POLICY "Public media delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'media');
