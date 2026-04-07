-- Add units_per_case to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS units_per_case INTEGER;

-- Recreate view with units_per_case included
DROP VIEW IF EXISTS public.deal_availability;

CREATE VIEW public.deal_availability AS
SELECT
  d.id,
  d.lp_name,
  d.brand,
  d.product_name,
  d.format,
  d.sku,
  d.credit_description,
  d.category,
  d.list_price,
  d.sale_price,
  d.thc,
  d.minor_cannabinoids,
  d.units_per_case,
  d.deal_expiry,
  d.notes,
  d.status,
  d.qty_total,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'pending'),   0)::INTEGER AS qty_reserved,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'accepted'),  0)::INTEGER AS qty_accepted,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'fulfilled'), 0)::INTEGER AS qty_fulfilled,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status IN ('pending', 'accepted', 'fulfilled')), 0)::INTEGER AS qty_allocated,
  (
    d.qty_total
    - COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status IN ('pending', 'accepted', 'fulfilled')), 0)
  )::INTEGER AS qty_available,
  d.created_at,
  d.updated_at
FROM public.deals d
LEFT JOIN public.sheet_retailers sr ON sr.deal_id = d.id
GROUP BY d.id;

GRANT SELECT ON public.deal_availability TO authenticated;
