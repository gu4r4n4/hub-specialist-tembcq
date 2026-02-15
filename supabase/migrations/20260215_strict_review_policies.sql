-- Ensure RLS is enabled
ALTER TABLE public.service_reviews ENABLE ROW LEVEL SECURITY;

-- Drop old policies to prevent conflicts
DROP POLICY IF EXISTS "Allow consumers to add reviews" ON public.service_reviews;
DROP POLICY IF EXISTS "Allow review only for completed consumer orders" ON public.service_reviews;
DROP POLICY IF EXISTS "service_reviews_select_active_services" ON public.service_reviews;
DROP POLICY IF EXISTS "service_reviews_insert_consumer_completed_order" ON public.service_reviews;
DROP POLICY IF EXISTS "service_reviews_update_own_review" ON public.service_reviews;
DROP POLICY IF EXISTS "service_reviews_delete_own_review" ON public.service_reviews;

-- Insert policy (yours + strict)
CREATE POLICY "Allow review only for completed consumer orders"
ON public.service_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  consumer_profile_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'consumer'
  )
  AND EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_id
      AND orders.consumer_profile_id = auth.uid()
      AND orders.service_id = service_reviews.service_id
      AND orders.status = 'done'
  )
);

-- Prevent multiple reviews per order
ALTER TABLE public.service_reviews
ADD CONSTRAINT service_reviews_order_id_unique UNIQUE (order_id);

-- Allow reading reviews (needed for UI)
DROP POLICY IF EXISTS "Public can read service reviews" ON public.service_reviews;

CREATE POLICY "Public can read service reviews"
ON public.service_reviews
FOR SELECT
TO anon, authenticated
USING (true);
