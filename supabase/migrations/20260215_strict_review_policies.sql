
-- Update Insert policy to handle User ID vs Profile ID mismatch
DROP POLICY IF EXISTS "Allow review only for completed consumer orders" ON public.service_reviews;

CREATE POLICY "Allow review only for completed consumer orders"
ON public.service_reviews
FOR INSERT
TO authenticated
WITH CHECK (
  -- The consumer_profile_id in the review MUST match the profile_id of the auth user
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = service_reviews.consumer_profile_id
      AND p.user_id = auth.uid()
      AND p.role = 'consumer'
  )
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_id
      AND o.consumer_profile_id = service_reviews.consumer_profile_id
      AND o.service_id = service_reviews.service_id
      AND o.status = 'done'
  )
);

-- Ensure users can see their own recently added reviews even if not yet approved/public
DROP POLICY IF EXISTS "Public can read service reviews" ON public.service_reviews;

CREATE POLICY "Public can read service reviews"
ON public.service_reviews
FOR SELECT
TO anon, authenticated
USING (true);
