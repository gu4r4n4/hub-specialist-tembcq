# Migration Guide: Reviews and Service Expiration

## Overview
This migration adds comprehensive review functionality and service expiration to your marketplace.

## What's Included

### 1. Service Expiration
- ✅ `expires_at` column on `services` table
- ✅ Indexes for efficient queries
- ✅ RLS policy preventing booking of expired services

### 2. Service Reviews
- ✅ `service_reviews` table with full schema
- ✅ One review per order (unique constraint)
- ✅ Rating from 1-5 stars
- ✅ Optional comment field

### 3. Security (RLS-First)
- ✅ **SELECT**: Public can only read reviews for active, non-expired services
- ✅ **INSERT**: Only consumers of completed orders can review
- ✅ **UPDATE/DELETE**: Only review author, within 7 days
- ✅ **Booking Protection**: Cannot create orders for expired services

### 4. Automated Rating Aggregation
- ✅ SECURITY DEFINER function to recalculate ratings
- ✅ Trigger automatically updates `services.rating_avg` and `rating_count`
- ✅ Bypasses RLS for system operations

## How to Apply

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open `supabase/migrations/20260215_add_reviews_and_expiration.sql`
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run**
7. Verify success (no errors)

### Option 2: Supabase CLI
```bash
# If you have Supabase CLI installed and linked
cd supabase
supabase db push
```

## Verification

After running the migration, verify it worked:

```sql
-- Check expires_at column exists
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'services' AND column_name = 'expires_at';

-- Check service_reviews table exists
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'service_reviews';

-- Check RLS policies on service_reviews
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'service_reviews';

-- Check triggers exist
SELECT trigger_name, event_manipulation, event_object_table 
FROM information_schema.triggers 
WHERE event_object_table = 'service_reviews';

-- Test the helper function
SELECT is_service_bookable('some-service-uuid-here');
```

## Testing the Features

### Test Service Expiration
```sql
-- Set a service to expire in the past
UPDATE services 
SET expires_at = NOW() - INTERVAL '1 day'
WHERE id = 'some-service-uuid';

-- Try to book it (should fail due to RLS policy)
-- This will be tested from your app
```

### Test Review Submission
```sql
-- Create a completed order first
INSERT INTO orders (consumer_profile_id, specialist_profile_id, service_id, status, scheduled_at, address)
VALUES ('consumer-uuid', 'specialist-uuid', 'service-uuid', 'done', NOW(), 'Test Address');

-- Submit a review (as the consumer)
INSERT INTO service_reviews (order_id, service_id, consumer_profile_id, specialist_profile_id, rating, comment)
VALUES ('order-uuid', 'service-uuid', 'consumer-uuid', 'specialist-uuid', 5, 'Great service!');

-- Check that rating_avg and rating_count were updated
SELECT id, title, rating_avg, rating_count 
FROM services 
WHERE id = 'service-uuid';
```

## RLS Policy Summary

### service_reviews Table

| Operation | Who Can Do It | Conditions |
|-----------|---------------|------------|
| SELECT | Anyone | Service must be active and not expired |
| INSERT | Consumer only | Order must be status='done', no duplicate review |
| UPDATE | Review author | Within 7 days of creation |
| DELETE | Review author | Within 7 days of creation |

### orders Table (Updated)

| Operation | Who Can Do It | Conditions |
|-----------|---------------|------------|
| INSERT | Consumer only | Service must be active and not expired |

## Important Notes

1. **SECURITY DEFINER Functions**: The rating aggregation function runs with elevated privileges to bypass RLS when updating service ratings. This is safe because it only updates rating fields.

2. **7-Day Edit Window**: Reviews can only be edited/deleted within 7 days of creation. Remove this restriction by editing the UPDATE/DELETE policies if needed.

3. **One Review Per Order**: The `UNIQUE(order_id)` constraint ensures each order can only have one review.

4. **Automatic Rating Updates**: When a review is added, updated, or deleted, the service's `rating_avg` and `rating_count` are automatically recalculated via trigger.

5. **Expired Service Protection**: Users cannot create new bookings for services where `expires_at` is in the past.

## Rollback (If Needed)

If you need to rollback this migration:

```sql
-- Drop triggers
DROP TRIGGER IF EXISTS service_reviews_update_rating_trigger ON service_reviews;
DROP TRIGGER IF EXISTS service_reviews_updated_at_trigger ON service_reviews;

-- Drop functions
DROP FUNCTION IF EXISTS trigger_update_service_rating();
DROP FUNCTION IF EXISTS update_service_rating_aggregates(UUID);
DROP FUNCTION IF EXISTS is_service_bookable(UUID);
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Drop policies
DROP POLICY IF EXISTS "orders_insert_active_service_only" ON orders;
DROP POLICY IF EXISTS "service_reviews_select_active_services" ON service_reviews;
DROP POLICY IF EXISTS "service_reviews_insert_consumer_completed_order" ON service_reviews;
DROP POLICY IF EXISTS "service_reviews_update_own_review" ON service_reviews;
DROP POLICY IF EXISTS "service_reviews_delete_own_review" ON service_reviews;

-- Drop table
DROP TABLE IF EXISTS service_reviews;

-- Remove column
ALTER TABLE services DROP COLUMN IF EXISTS expires_at;
```

## Next Steps

After applying this migration:

1. ✅ Update TypeScript types (`types/database.ts`)
2. ✅ Create UI components (`ReviewForm.tsx`, `ReviewsList.tsx`)
3. ✅ Update service listing queries to filter expired services
4. ✅ Add review form to completed orders
5. ✅ Add expiration date picker to service creation form

See `CODEBASE_ANALYSIS.md` for detailed implementation instructions.

## Support

If you encounter any issues:
- Check Supabase logs for RLS policy violations
- Verify user authentication state
- Ensure profile records exist for test users
- Check that orders have status='done' before testing reviews
