-- =============================================================================
-- Auto-register retailer on order submission
--
-- When a retailer submits via the generic /order/[sheetId] link they don't have
-- a retailer_id. This update to submit_order looks up an existing retailer by
-- name (case-insensitive) or creates a new one if not found, so every submitted
-- order always has a real retailer_id. This means:
--   - accept/reject/fulfill RPCs work for all orders
--   - Dashboard order cards always link correctly
--   - The retailer database grows organically as orders come in
-- =============================================================================

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
DECLARE
  v_retailer_id UUID := p_retailer_id;
BEGIN
  -- Sheet must be in 'sent' status to accept orders
  IF NOT EXISTS (
    SELECT 1 FROM public.sheets WHERE id = p_sheet_id AND status = 'sent'
  ) THEN
    RAISE EXCEPTION 'This order sheet is no longer accepting orders.';
  END IF;

  -- If no retailer_id supplied, look up an existing retailer by name.
  -- If none found, create one automatically (status = active).
  IF v_retailer_id IS NULL AND p_retailer_name IS NOT NULL AND TRIM(p_retailer_name) != '' THEN
    SELECT id INTO v_retailer_id
    FROM public.retailers
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(p_retailer_name))
    LIMIT 1;

    IF v_retailer_id IS NULL THEN
      INSERT INTO public.retailers (name, status)
      VALUES (TRIM(p_retailer_name), 'active')
      RETURNING id INTO v_retailer_id;
    END IF;
  END IF;

  -- Remove any previous order lines for this retailer on this sheet.
  -- Placeholder rows (deal_id IS NULL) are preserved — they carry the order_token.
  DELETE FROM public.sheet_retailers
  WHERE sheet_id = p_sheet_id
    AND deal_id IS NOT NULL
    AND (
      (v_retailer_id IS NOT NULL AND retailer_id = v_retailer_id)
      OR (v_retailer_id IS NULL AND retailer_name = p_retailer_name AND retailer_id IS NULL)
    );

  -- Insert the new order lines
  INSERT INTO public.sheet_retailers (
    sheet_id, deal_id, retailer_id, retailer_name,
    alloc_qty, status, requested_ship_date, retailer_notes
  )
  SELECT
    p_sheet_id,
    (line->>'deal_id')::UUID,
    v_retailer_id,
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
