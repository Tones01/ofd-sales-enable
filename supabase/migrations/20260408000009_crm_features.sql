-- =============================================================================
-- CRM Features: per-retailer order tokens, accept/reject RPCs,
--               sheet owner delete policy, drop ship_instructions constraint
-- =============================================================================

-- 1. Drop the ship_instructions constraint (not used in current workflow)
ALTER TABLE public.sheet_retailers
  DROP CONSTRAINT IF EXISTS ship_instructions_on_acceptance;

-- 2. Let sheet owners delete retailers from their sheets (draft only)
--    (initial schema only allowed admins to delete)
CREATE POLICY "sheet_retailers: owners delete on draft sheet"
  ON public.sheet_retailers FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sheets s
      WHERE s.id = sheet_id
        AND s.created_by = auth.uid()
        AND s.status = 'draft'
    )
  );

-- 3. Per-retailer order tokens
--    Placeholder rows (deal_id IS NULL) get a unique token.
--    Order lines (deal_id IS NOT NULL) leave it NULL — they're identified by retailer_id.

ALTER TABLE public.sheet_retailers
  ADD COLUMN IF NOT EXISTS order_token UUID;

-- Assign tokens to any existing placeholder rows
UPDATE public.sheet_retailers
  SET order_token = gen_random_uuid()
  WHERE order_token IS NULL AND deal_id IS NULL;

-- Unique partial index — only for placeholder rows that have a token
CREATE UNIQUE INDEX IF NOT EXISTS sheet_retailers_order_token_idx
  ON public.sheet_retailers(order_token)
  WHERE order_token IS NOT NULL;

-- 4. Updated submit_order
--    Key change: keep placeholder rows (deal_id IS NULL) intact — they hold the token.
--    Only delete and replace the actual order lines (deal_id IS NOT NULL).
CREATE OR REPLACE FUNCTION public.submit_order(
  p_sheet_id            UUID,
  p_retailer_id         UUID,
  p_retailer_name       TEXT,
  p_requested_ship_date DATE,
  p_retailer_notes      TEXT,
  p_lines               JSONB  -- [{deal_id, alloc_qty}, ...]
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sheets WHERE id = p_sheet_id AND status = 'sent'
  ) THEN
    RAISE EXCEPTION 'This order sheet is no longer accepting orders.';
  END IF;

  -- Remove previous ORDER LINES only (deal_id IS NOT NULL) for this retailer.
  -- Placeholder rows (deal_id IS NULL) stay intact — they carry the order_token.
  DELETE FROM public.sheet_retailers
  WHERE sheet_id = p_sheet_id
    AND deal_id IS NOT NULL
    AND (
      (p_retailer_id IS NOT NULL AND retailer_id = p_retailer_id)
      OR (p_retailer_id IS NULL AND retailer_name = p_retailer_name AND retailer_id IS NULL)
    );

  -- Insert new order lines (no order_token — tokens belong to placeholder rows)
  INSERT INTO public.sheet_retailers (
    sheet_id, deal_id, retailer_id, retailer_name,
    alloc_qty, status, requested_ship_date, retailer_notes
  )
  SELECT
    p_sheet_id,
    (line->>'deal_id')::UUID,
    p_retailer_id,
    p_retailer_name,
    (line->>'alloc_qty')::INTEGER,
    'pending',
    p_requested_ship_date,
    p_retailer_notes
  FROM jsonb_array_elements(p_lines) AS line
  WHERE (line->>'alloc_qty')::INTEGER > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_order TO anon;
GRANT EXECUTE ON FUNCTION public.submit_order TO authenticated;

-- 5. accept_order: mark all pending order lines for a retailer as accepted
CREATE OR REPLACE FUNCTION public.accept_order(
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
  SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
  WHERE sheet_id   = p_sheet_id
    AND retailer_id = p_retailer_id
    AND deal_id IS NOT NULL
    AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_order TO authenticated;

-- 6. reject_order: mark all pending order lines for a retailer as rejected
CREATE OR REPLACE FUNCTION public.reject_order(
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
  SET status = 'rejected', responded_at = NOW(), updated_at = NOW()
  WHERE sheet_id    = p_sheet_id
    AND retailer_id  = p_retailer_id
    AND deal_id IS NOT NULL
    AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_order TO authenticated;

-- 7. Refresh deal_availability view (unchanged logic, ensures deal_id IS NOT NULL filter)
DROP VIEW IF EXISTS public.deal_availability;

CREATE VIEW public.deal_availability AS
SELECT
  d.id, d.lp_name, d.brand, d.product_name, d.format, d.sku,
  d.credit_description, d.category, d.list_price, d.sale_price,
  d.thc, d.minor_cannabinoids, d.units_per_case, d.deal_expiry,
  d.notes, d.status, d.qty_total,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'pending'   AND sr.deal_id IS NOT NULL), 0)::INTEGER AS qty_reserved,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'accepted'  AND sr.deal_id IS NOT NULL), 0)::INTEGER AS qty_accepted,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'fulfilled' AND sr.deal_id IS NOT NULL), 0)::INTEGER AS qty_fulfilled,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status IN ('pending','accepted','fulfilled') AND sr.deal_id IS NOT NULL), 0)::INTEGER AS qty_allocated,
  (d.qty_total - COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status IN ('pending','accepted','fulfilled') AND sr.deal_id IS NOT NULL), 0))::INTEGER AS qty_available,
  d.created_at, d.updated_at
FROM public.deals d
LEFT JOIN public.sheet_retailers sr ON sr.deal_id = d.id
GROUP BY d.id;

GRANT SELECT ON public.deal_availability TO authenticated;
