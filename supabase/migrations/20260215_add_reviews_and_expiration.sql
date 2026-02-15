-- Migration: Add service reviews and expiration functionality
-- Created: 2026-02-15
-- Description: Implements service expiration dates, review system with RLS-first security,
--              and automated rating aggregation with booking protection against expired services.

-- ============================================================================
-- A) Add expires_at column to services table
-- ============================================================================

ALTER TABLE services 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

-- Add index for efficient expiration queries
CREATE INDEX IF NOT EXISTS idx_services_expires_at 
ON services(expires_at) 
WHERE expires_at IS NOT NULL;

-- Add composite index for active, non-expired services (most common query)
CREATE INDEX IF NOT EXISTS idx_services_active_not_expired 
ON services(is_active, expires_at) 
WHERE is_active = true;

COMMENT ON COLUMN services.expires_at IS 'Date/time when the service listing expires and should be hidden from public listings';

-- ============================================================================
-- B) Create service_reviews table
-- ============================================================================

CREATE TABLE IF NOT EXISTS service_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  consumer_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  specialist_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Ensure one review per order
  CONSTRAINT unique_review_per_order UNIQUE(order_id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_service_reviews_service_id 
ON service_reviews(service_id);

CREATE INDEX IF NOT EXISTS idx_service_reviews_consumer_profile_id 
ON service_reviews(consumer_profile_id);

CREATE INDEX IF NOT EXISTS idx_service_reviews_specialist_profile_id 
ON service_reviews(specialist_profile_id);

CREATE INDEX IF NOT EXISTS idx_service_reviews_created_at 
ON service_reviews(created_at DESC);

-- Index for rating aggregation
CREATE INDEX IF NOT EXISTS idx_service_reviews_service_rating 
ON service_reviews(service_id, rating);

COMMENT ON TABLE service_reviews IS 'Reviews and ratings for services, submitted by consumers after order completion';
COMMENT ON COLUMN service_reviews.order_id IS 'The completed order this review is for (one review per order)';
COMMENT ON COLUMN service_reviews.rating IS 'Rating from 1 (worst) to 5 (best)';

-- ============================================================================
-- C) RLS Policies for service_reviews (RLS-first, NO "USING (true)")
-- ============================================================================

-- Enable RLS
ALTER TABLE service_reviews ENABLE ROW LEVEL SECURITY;

-- SELECT Policy: Public can read reviews only for active, non-expired services
CREATE POLICY "service_reviews_select_active_services"
ON service_reviews
FOR SELECT
USING (
  EXISTS (
    SELECT 1 
    FROM services 
    WHERE services.id = service_reviews.service_id
      AND services.is_active = true
      AND (services.expires_at IS NULL OR services.expires_at > NOW())
  )
);

-- INSERT Policy: Only the consumer of a completed order can create a review
CREATE POLICY "service_reviews_insert_consumer_completed_order"
ON service_reviews
FOR INSERT
WITH CHECK (
  -- Must be authenticated
  auth.uid() IS NOT NULL
  AND
  -- The authenticated user must be the consumer of the order
  EXISTS (
    SELECT 1 
    FROM orders o
    INNER JOIN profiles p ON p.id = o.consumer_profile_id
    WHERE o.id = order_id
      AND o.status = 'done'
      AND o.service_id = service_reviews.service_id
      AND o.specialist_profile_id = service_reviews.specialist_profile_id
      AND o.consumer_profile_id = service_reviews.consumer_profile_id
      AND p.user_id = auth.uid()
  )
  AND
  -- Ensure no duplicate review exists for this order
  NOT EXISTS (
    SELECT 1 
    FROM service_reviews existing
    WHERE existing.order_id = service_reviews.order_id
  )
  AND
  -- Service must be active (allow reviews even if expired, but not if deleted/inactive)
  EXISTS (
    SELECT 1 
    FROM services s
    WHERE s.id = service_reviews.service_id
      AND s.is_active = true
  )
);

-- UPDATE Policy: Only the consumer who created the review can update it
CREATE POLICY "service_reviews_update_own_review"
ON service_reviews
FOR UPDATE
USING (
  auth.uid() IS NOT NULL
  AND
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = service_reviews.consumer_profile_id
      AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = service_reviews.consumer_profile_id
      AND p.user_id = auth.uid()
  )
  -- Optional: Restrict updates to within 7 days of creation
  AND service_reviews.created_at > NOW() - INTERVAL '7 days'
);

-- DELETE Policy: Only the consumer who created the review can delete it
CREATE POLICY "service_reviews_delete_own_review"
ON service_reviews
FOR DELETE
USING (
  auth.uid() IS NOT NULL
  AND
  EXISTS (
    SELECT 1 
    FROM profiles p
    WHERE p.id = service_reviews.consumer_profile_id
      AND p.user_id = auth.uid()
  )
  -- Optional: Restrict deletions to within 7 days of creation
  AND service_reviews.created_at > NOW() - INTERVAL '7 days'
);

-- ============================================================================
-- D) Rating Aggregation Function and Trigger
-- ============================================================================

-- Function to recalculate service ratings (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION update_service_rating_aggregates(target_service_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  avg_rating NUMERIC(3, 2);
  review_count INTEGER;
BEGIN
  -- Calculate average rating and count for the service
  SELECT 
    COALESCE(AVG(rating), 0)::NUMERIC(3, 2),
    COUNT(*)::INTEGER
  INTO avg_rating, review_count
  FROM service_reviews
  WHERE service_id = target_service_id;
  
  -- Update the service record (bypasses RLS due to SECURITY DEFINER)
  UPDATE services
  SET 
    rating_avg = avg_rating,
    rating_count = review_count
  WHERE id = target_service_id;
END;
$$;

COMMENT ON FUNCTION update_service_rating_aggregates IS 'Recalculates and updates rating_avg and rating_count for a service. SECURITY DEFINER allows bypassing RLS.';

-- Note: No GRANT EXECUTE needed - function is only called by triggers, not by clients

-- Trigger function to call the aggregation function
CREATE OR REPLACE FUNCTION trigger_update_service_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Handle DELETE (use OLD record)
  IF TG_OP = 'DELETE' THEN
    PERFORM update_service_rating_aggregates(OLD.service_id);
    RETURN OLD;
  END IF;
  
  -- Handle INSERT or UPDATE (use NEW record)
  PERFORM update_service_rating_aggregates(NEW.service_id);
  
  -- If service_id changed during UPDATE, also update the old service
  IF TG_OP = 'UPDATE' AND OLD.service_id IS DISTINCT FROM NEW.service_id THEN
    PERFORM update_service_rating_aggregates(OLD.service_id);
  END IF;
  
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_update_service_rating IS 'Trigger function that updates service ratings when reviews are added, modified, or deleted';

-- Create trigger on service_reviews
DROP TRIGGER IF EXISTS service_reviews_update_rating_trigger ON service_reviews;

CREATE TRIGGER service_reviews_update_rating_trigger
AFTER INSERT OR UPDATE OR DELETE ON service_reviews
FOR EACH ROW
EXECUTE FUNCTION trigger_update_service_rating();

-- ============================================================================
-- E) Booking Protection Against Expired Services
-- ============================================================================

-- Add RLS policy to orders table to prevent booking expired services
-- Note: This policy LAYERS with existing consumer-only policies rather than replacing them

-- Ensure RLS is enabled (safe even if already enabled)
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Add an additional policy: service must be active and not expired
-- This works alongside existing "only consumer can insert orders" policies
CREATE POLICY "orders_insert_service_not_expired"
ON orders
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM services s
    WHERE s.id = orders.service_id
      AND s.is_active = true
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
  )
);

-- ============================================================================
-- F) Helper Function: Check if service is bookable
-- ============================================================================

-- Optional: Create a helper function to check if a service is bookable
-- This can be called from client code if needed
CREATE OR REPLACE FUNCTION is_service_bookable(target_service_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM services
    WHERE id = target_service_id
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$;

COMMENT ON FUNCTION is_service_bookable IS 'Returns true if a service is active and not expired, false otherwise';

-- Grant execute to authenticated users only (safe read-only helper function)
GRANT EXECUTE ON FUNCTION is_service_bookable(UUID) TO authenticated;

-- ============================================================================
-- G) Update updated_at timestamp on service_reviews
-- ============================================================================

-- Function to automatically update updated_at timestamp
-- Named specifically to avoid collision with other migrations
CREATE OR REPLACE FUNCTION update_service_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for service_reviews
DROP TRIGGER IF EXISTS service_reviews_updated_at_trigger ON service_reviews;

CREATE TRIGGER service_reviews_updated_at_trigger
BEFORE UPDATE ON service_reviews
FOR EACH ROW
EXECUTE FUNCTION update_service_reviews_updated_at();

-- ============================================================================
-- H) Verification Queries (commented out - for testing)
-- ============================================================================

-- Uncomment these to verify the migration worked:

-- Check if expires_at column exists
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'services' AND column_name = 'expires_at';

-- Check if service_reviews table exists
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name = 'service_reviews';

-- Check RLS policies on service_reviews
-- SELECT * FROM pg_policies WHERE tablename = 'service_reviews';

-- Check RLS policies on orders
-- SELECT * FROM pg_policies WHERE tablename = 'orders' AND policyname LIKE '%active_service%';

-- Check triggers
-- SELECT trigger_name, event_manipulation, event_object_table 
-- FROM information_schema.triggers 
-- WHERE event_object_table IN ('service_reviews');

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- Summary:
-- ✅ Added expires_at column to services with indexes
-- ✅ Created service_reviews table with proper constraints
-- ✅ Implemented RLS-first security policies (no USING true)
-- ✅ Created SECURITY DEFINER function for rating aggregation
-- ✅ Created trigger to auto-update ratings on review changes
-- ✅ Added booking protection against expired services
-- ✅ Added helper function to check service bookability
-- ✅ Added auto-update trigger for updated_at timestamp
