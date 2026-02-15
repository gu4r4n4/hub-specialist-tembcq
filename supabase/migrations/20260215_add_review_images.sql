-- Migration: Add service review images support
-- Created: 2026-02-15
-- Description: Implements image attachments for service reviews with RLS-first security.
--              Images are stored in Supabase Storage and tracked in service_review_images table.
--              RLS policies mirror parent review visibility and enforce ownership.

-- ============================================================================
-- A) Create service_review_images table
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_review_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES service_reviews(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Prevent duplicate paths for the same review
  CONSTRAINT unique_review_image_path UNIQUE(review_id, storage_path)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_service_review_images_review_id 
ON service_review_images(review_id);

CREATE INDEX IF NOT EXISTS idx_service_review_images_created_at 
ON service_review_images(created_at DESC);

COMMENT ON TABLE service_review_images IS 'Images attached to service reviews, stored in Supabase Storage';
COMMENT ON COLUMN service_review_images.storage_path IS 'Path to image in storage bucket, format: reviews/<review_id>/<uuid>.jpg';
COMMENT ON COLUMN service_review_images.review_id IS 'Parent review this image belongs to';

-- ============================================================================
-- B) RLS Policies for service_review_images
-- ============================================================================

-- Enable RLS
ALTER TABLE service_review_images ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Mirror parent review visibility (active, non-expired services only)
CREATE POLICY "service_review_images_select_public"
ON service_review_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM service_reviews r
    INNER JOIN services s ON s.id = r.service_id
    WHERE r.id = service_review_images.review_id
      AND s.is_active = true
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
  )
);

-- INSERT Policy: Only the owner of the parent review can add images
CREATE POLICY "service_review_images_insert_owner"
ON service_review_images
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  EXISTS (
    SELECT 1
    FROM service_reviews r
    INNER JOIN profiles p ON p.id = r.consumer_profile_id
    WHERE r.id = service_review_images.review_id
      AND p.user_id = auth.uid()
  )
);

-- DELETE Policy: Only the owner of the parent review can delete images
CREATE POLICY "service_review_images_delete_owner"
ON service_review_images
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND
  EXISTS (
    SELECT 1
    FROM service_reviews r
    INNER JOIN profiles p ON p.id = r.consumer_profile_id
    WHERE r.id = service_review_images.review_id
      AND p.user_id = auth.uid()
  )
);

-- UPDATE Policy: Disallow updates entirely (images are immutable once uploaded)
-- No UPDATE policy = no one can update (recommended for image records)

-- ============================================================================
-- C) Helper function to check review ownership
-- ============================================================================

-- This function can be used by storage policies to verify review ownership
CREATE OR REPLACE FUNCTION is_review_owner(target_review_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM service_reviews r
    INNER JOIN profiles p ON p.id = r.consumer_profile_id
    WHERE r.id = target_review_id
      AND p.user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION is_review_owner IS 'Returns true if the authenticated user owns the specified review';

-- Grant execute to authenticated users only
GRANT EXECUTE ON FUNCTION is_review_owner(UUID) TO authenticated;

-- ============================================================================
-- D) Verification Queries (commented out - for testing)
-- ============================================================================

-- Uncomment these to verify the migration worked:

-- Check if service_review_images table exists
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'service_review_images';

-- Check RLS policies on service_review_images
-- SELECT policyname, cmd FROM pg_policies 
-- WHERE tablename = 'service_review_images';

-- Check indexes
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename = 'service_review_images';

-- Check helper function
-- SELECT routine_name FROM information_schema.routines 
-- WHERE routine_name = 'is_review_owner';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- ✅ Created service_review_images table with proper constraints
-- ✅ Added indexes for efficient queries
-- ✅ Implemented RLS-first security policies
-- ✅ SELECT mirrors parent review visibility (active, non-expired services)
-- ✅ INSERT/DELETE only by review owner
-- ✅ UPDATE disabled (images are immutable)
-- ✅ Created helper function for storage policy use
-- ✅ No unnecessary grants (authenticated only for helper)
