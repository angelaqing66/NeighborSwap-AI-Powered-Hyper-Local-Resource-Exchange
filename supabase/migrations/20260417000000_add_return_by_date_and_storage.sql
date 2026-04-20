-- supabase/migrations/20260417000000_add_return_by_date_and_storage.sql
-- ============================================================
-- Adds structured return_by_date field to public.items and
-- provisions the item-photos Supabase Storage bucket.
-- ============================================================

-- 1. Schema change: add return_by_date to items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS return_by_date DATE;

COMMENT ON COLUMN public.items.return_by_date IS
  'Optional "Return by" date specified by the Provider when posting the item.';

-- 2. Storage: create item-photos bucket (public read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'item-photos',
  'item-photos',
  true,
  5242880, -- 5 MB limit per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS: authenticated providers can upload to their own folder
--    File path convention: {user_id}/{listing_id}.{ext}
CREATE POLICY "item_photos_insert_owner"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'item-photos'
    AND auth.role() = 'authenticated'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "item_photos_update_owner"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'item-photos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );

CREATE POLICY "item_photos_delete_owner"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'item-photos'
    AND auth.uid()::text = (string_to_array(name, '/'))[1]
  );
