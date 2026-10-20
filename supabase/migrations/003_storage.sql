-- Storage buckets and policies for MimiGram media

-- Create media bucket (run via Supabase dashboard or storage API if not exists)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES (
--   'media',
--   'media',
--   true,
--   52428800, -- 50MB
--   ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
-- ) ON CONFLICT (id) DO NOTHING;

-- Note: Storage policies are typically set via Supabase dashboard or SQL on storage.objects
-- Example policies (adjust as needed):

-- Public read for media
-- CREATE POLICY "Public media access"
-- ON storage.objects FOR SELECT
-- USING (bucket_id = 'media');

-- Authenticated upload (backend uses service role for signed URLs preferably)
-- CREATE POLICY "Authenticated upload"
-- ON storage.objects FOR INSERT
-- WITH CHECK (bucket_id = 'media');

-- Owner delete (path structure: user_id/filename)
-- CREATE POLICY "Owner can delete own media"
-- ON storage.objects FOR DELETE
-- USING (bucket_id = 'media' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Recommended path structure:
-- media/{user_id}/{post_id}/{filename}
-- or media/{user_id}/{uuid}.{ext}
