-- Supabase Storage Policies for Review Images
-- Bucket: review-images
-- Path pattern: reviews/<review_id>/<uuid>.jpg

-- ============================================================================
-- IMPORTANT: Run this AFTER creating the 'review-images' bucket in Supabase Dashboard
-- ============================================================================

-- Storage bucket setup (run in Supabase Dashboard Storage section):
-- 1. Create bucket named: review-images
-- 2. Set as PUBLIC bucket (for public read access)
-- 3. File size limit: 5MB (recommended)
-- 4. Allowed MIME types: image/jpeg, image/png, image/webp

-- ============================================================================
-- Storage Policies for storage.objects
-- ============================================================================

-- Policy A: Public READ access for review-images bucket
-- This allows anyone to view review images (same as SELECT on service_review_images)
CREATE POLICY "review_images_public_read"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'review-images'
);

-- Policy B: Authenticated INSERT - users can upload only to their own review folders
-- Path must be: reviews/<review_id>/<filename>
-- User must own the review (verified via is_review_owner function)
-- UUID validation prevents casting error injection
CREATE POLICY "review_images_authenticated_insert"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'review-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'reviews'
  AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND is_review_owner(((storage.foldername(name))[2])::uuid)
);

-- Policy C: Authenticated DELETE - users can delete only their own review images
-- Same ownership check as INSERT with UUID validation
CREATE POLICY "review_images_authenticated_delete"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'review-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'reviews'
  AND (storage.foldername(name))[2] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  AND is_review_owner(((storage.foldername(name))[2])::uuid)
);

-- Policy D: Disallow UPDATE on storage objects (images are immutable)
-- No UPDATE policy = no one can update

-- ============================================================================
-- Alternative: Simpler approach with private bucket + signed URLs
-- ============================================================================

-- If the above storage policies are too complex or cause issues, use this simpler approach:
-- 
-- 1. Create PRIVATE bucket (not public)
-- 2. Use these simpler storage policies:

/*
-- Allow authenticated users to INSERT into review-images
CREATE POLICY "review_images_authenticated_insert_simple"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'review-images'
  AND auth.uid() IS NOT NULL
);

-- Allow authenticated users to DELETE their own uploads
-- (ownership verified at DB table level via service_review_images RLS)
CREATE POLICY "review_images_authenticated_delete_simple"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'review-images'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = 'reviews'
);

-- For reading: use signed URLs generated server-side or via Supabase client
-- This gives you more control over access and doesn't require public bucket
*/

-- ============================================================================
-- Verification Queries
-- ============================================================================

-- Check storage policies exist
-- SELECT policyname, cmd FROM pg_policies 
-- WHERE schemaname = 'storage' AND tablename = 'objects' 
-- AND policyname LIKE '%review_images%';

-- Test is_review_owner function
-- SELECT is_review_owner('some-review-uuid-here');

-- ============================================================================
-- Notes
-- ============================================================================

-- Path Pattern Enforcement:
-- The storage policies use storage.foldername(name) to extract folder parts:
-- - (storage.foldername(name))[1] = 'reviews' (first folder)
-- - (storage.foldername(name))[2] = review_id (second folder, the UUID)
-- 
-- Example valid path: reviews/123e4567-e89b-12d3-a456-426614174000/abc123.jpg
-- - [1] = 'reviews'
-- - [2] = '123e4567-e89b-12d3-a456-426614174000'
-- - filename = 'abc123.jpg'

-- Security Model:
-- 1. DB Table (service_review_images):
--    - RLS enforces ownership at table level
--    - Only review owner can INSERT/DELETE records
-- 
-- 2. Storage (storage.objects):
--    - Public READ (anyone can view images)
--    - Authenticated INSERT/DELETE with ownership check via is_review_owner()
--    - Path pattern enforced: reviews/<review_id>/<filename>
-- 
-- 3. Workflow:
--    a) User uploads image to storage (INSERT policy checks ownership)
--    b) User creates DB record with storage_path (INSERT policy checks ownership)
--    c) Both must succeed for image to be visible
--    d) If user deletes review, CASCADE deletes image records
--    e) App should clean up orphaned storage files (optional background job)

-- Recommended: Implement storage cleanup
-- Create a periodic job to delete storage files that don't have corresponding DB records
-- This prevents orphaned files from accumulating if upload succeeds but DB insert fails
