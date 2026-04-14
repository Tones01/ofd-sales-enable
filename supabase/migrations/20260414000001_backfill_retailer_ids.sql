-- =============================================================================
-- Backfill retailer_id on anonymous order lines
--
-- Orders submitted via the generic /order/[sheetId] link before the
-- auto-retailer migration (20260413000001) landed with retailer_id = NULL.
-- This means dashboard links fall back to the sheet view instead of the
-- individual order review page.
--
-- This migration runs the same name-matching logic for every existing
-- null-retailer order line:
--   1. Look up an existing retailer by name (case-insensitive)
--   2. If none found, create one (status = active)
--   3. Update all order lines for that retailer_name on that sheet
--      to point at the resolved retailer_id
-- =============================================================================

DO $$
DECLARE
  rec          RECORD;
  v_retailer_id UUID;
BEGIN
  -- Iterate over each distinct (sheet_id, retailer_name) pair that is missing a retailer_id
  FOR rec IN
    SELECT DISTINCT sheet_id, retailer_name
    FROM public.sheet_retailers
    WHERE retailer_id IS NULL
      AND deal_id IS NOT NULL
      AND retailer_name IS NOT NULL
      AND TRIM(retailer_name) <> ''
  LOOP
    v_retailer_id := NULL;

    -- Try to find an existing retailer by name
    SELECT id INTO v_retailer_id
    FROM public.retailers
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(rec.retailer_name))
    LIMIT 1;

    -- If not found, create one
    IF v_retailer_id IS NULL THEN
      INSERT INTO public.retailers (name, status)
      VALUES (TRIM(rec.retailer_name), 'active')
      RETURNING id INTO v_retailer_id;
    END IF;

    -- Patch all order lines for this (sheet, retailer_name) pair
    UPDATE public.sheet_retailers
    SET retailer_id = v_retailer_id
    WHERE sheet_id    = rec.sheet_id
      AND retailer_name = rec.retailer_name
      AND retailer_id IS NULL
      AND deal_id IS NOT NULL;

  END LOOP;
END;
$$;
