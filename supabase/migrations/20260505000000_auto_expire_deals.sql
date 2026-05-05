-- Auto-expire deals whose deal_expiry has passed.
--
-- Deals have status IN ('active', 'closed'). Once deal_expiry < CURRENT_DATE
-- there's no reason to keep them active — they should drop out of the
-- default Deals list and become unselectable on new sheets.
--
-- This migration:
--   1. Adds an index on deal_expiry for cheap lookups.
--   2. Defines expire_old_deals() — idempotent, SECURITY DEFINER so it can
--      flip rows regardless of the caller's RLS write privileges.
--   3. Backfills any already-expired active deals.

CREATE INDEX IF NOT EXISTS deals_deal_expiry_idx
  ON public.deals (deal_expiry)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION public.expire_old_deals()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.deals
     SET status = 'closed',
         updated_at = NOW()
   WHERE status = 'active'
     AND deal_expiry IS NOT NULL
     AND deal_expiry < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_old_deals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_old_deals() TO authenticated;

SELECT public.expire_old_deals();
