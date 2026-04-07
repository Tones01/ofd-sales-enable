-- Ship date set by the rep when creating/sending the sheet (e.g. one-time deal deadline)
ALTER TABLE public.sheets
  ADD COLUMN IF NOT EXISTS ship_date DATE;

-- Requested ship date submitted by the retailer when they fill out the order form
ALTER TABLE public.sheet_retailers
  ADD COLUMN IF NOT EXISTS requested_ship_date DATE,
  ADD COLUMN IF NOT EXISTS retailer_name       TEXT,  -- free-text if not linked to retailers table
  ADD COLUMN IF NOT EXISTS retailer_notes      TEXT;  -- any notes the retailer adds with their order
