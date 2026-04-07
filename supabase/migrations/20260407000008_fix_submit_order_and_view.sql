-- Update submit_order to delete placeholder rows (null deal_id) before inserting real orders
CREATE OR REPLACE FUNCTION public.submit_order(
  p_sheet_id            UUID,
  p_retailer_id         UUID,
  p_retailer_name       TEXT,
  p_requested_ship_date DATE,
  p_retailer_notes      TEXT,
  p_lines               JSONB
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

  -- Remove placeholder send-list rows AND any previous pending order rows for this retailer
  DELETE FROM public.sheet_retailers
  WHERE sheet_id = p_sheet_id
    AND (
      (p_retailer_id IS NOT NULL AND retailer_id = p_retailer_id)
      OR (p_retailer_id IS NULL AND retailer_name = p_retailer_name)
    )
    AND status = 'pending';

  -- Insert actual order lines
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

-- Refresh deal_availability view to exclude null deal_id rows (send-list placeholders)
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
