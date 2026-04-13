-- Fulfill order: mark all accepted order lines for a retailer as fulfilled
-- Called by reps once the order has been picked, packed, and shipped.

CREATE OR REPLACE FUNCTION public.fulfill_order(
  p_sheet_id    UUID,
  p_retailer_id UUID
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.sheet_retailers
  SET status = 'fulfilled', updated_at = NOW()
  WHERE sheet_id    = p_sheet_id
    AND retailer_id = p_retailer_id
    AND deal_id IS NOT NULL
    AND status = 'accepted';
END;
$$;

GRANT EXECUTE ON FUNCTION public.fulfill_order TO authenticated;
