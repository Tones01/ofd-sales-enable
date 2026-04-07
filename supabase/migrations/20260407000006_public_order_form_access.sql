-- ============================================================
-- Public order form access
-- Allow unauthenticated users to read sent sheets + submit orders
-- ============================================================

-- 1. Sent sheets are publicly readable (order form needs to verify the sheet)
CREATE POLICY "sheets: public read sent"
  ON public.sheets FOR SELECT
  USING (status = 'sent');

-- 2. Deals on a sent sheet are publicly readable (order form product list)
CREATE POLICY "sheet_deals: public read on sent sheet"
  ON public.sheet_deals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.sheets WHERE id = sheet_id AND status = 'sent')
  );

-- 3. Retailer list on a sent sheet is publicly readable (store dropdown)
CREATE POLICY "sheet_retailers: public read on sent sheet"
  ON public.sheet_retailers FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.sheets WHERE id = sheet_id AND status = 'sent')
  );

-- 4. Active deals are publicly readable (needed for the joined product data)
CREATE POLICY "deals: public read active"
  ON public.deals FOR SELECT
  USING (status = 'active');

-- 5. Retailers table is publicly readable (needed for store name lookup)
CREATE POLICY "retailers: public read active"
  ON public.retailers FOR SELECT
  USING (status = 'active');

-- ============================================================
-- submit_order RPC
-- SECURITY DEFINER bypasses RLS so the public can write order rows.
-- Validates the sheet is 'sent' before inserting.
-- ============================================================

CREATE OR REPLACE FUNCTION public.submit_order(
  p_sheet_id           UUID,
  p_retailer_id        UUID,
  p_retailer_name      TEXT,
  p_requested_ship_date DATE,
  p_retailer_notes     TEXT,
  p_lines              JSONB   -- [{deal_id, alloc_qty}, ...]
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Validate sheet is sent and accepting orders
  IF NOT EXISTS (
    SELECT 1 FROM public.sheets WHERE id = p_sheet_id AND status = 'sent'
  ) THEN
    RAISE EXCEPTION 'This order sheet is no longer accepting orders.';
  END IF;

  -- Remove any previous pending submission from this retailer on this sheet
  IF p_retailer_id IS NOT NULL THEN
    DELETE FROM public.sheet_retailers
    WHERE sheet_id = p_sheet_id
      AND retailer_id = p_retailer_id
      AND status = 'pending';
  END IF;

  -- Insert one row per order line
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

-- Allow anonymous (unauthenticated) users to call submit_order
GRANT EXECUTE ON FUNCTION public.submit_order TO anon;
GRANT EXECUTE ON FUNCTION public.submit_order TO authenticated;
