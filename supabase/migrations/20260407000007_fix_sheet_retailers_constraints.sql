-- sheet_retailers serves two purposes:
-- 1. Send list: retailer is on the sheet (deal_id null, alloc_qty 0) — set by rep
-- 2. Order allocation: retailer has placed an order (deal_id set, alloc_qty > 0) — set by order form
-- Relax both constraints to allow both states.

ALTER TABLE public.sheet_retailers
  ALTER COLUMN deal_id DROP NOT NULL;

ALTER TABLE public.sheet_retailers
  DROP CONSTRAINT IF EXISTS sheet_retailers_alloc_qty_check;

ALTER TABLE public.sheet_retailers
  ADD CONSTRAINT sheet_retailers_alloc_qty_check
  CHECK (alloc_qty >= 0);
