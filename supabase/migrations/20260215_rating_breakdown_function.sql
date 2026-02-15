-- Add RPC function to get rating breakdown for a service
CREATE OR REPLACE FUNCTION get_service_rating_breakdown(p_service_id uuid)
RETURNS TABLE (rating int, count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    rating::int,
    COUNT(*)::bigint
  FROM public.service_reviews
  WHERE service_id = p_service_id
  GROUP BY rating
  ORDER BY rating DESC;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_service_rating_breakdown(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_service_rating_breakdown(uuid) TO anon;
