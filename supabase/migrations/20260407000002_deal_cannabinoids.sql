-- Add cannabinoid profile columns to deals
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS thc               TEXT,
  ADD COLUMN IF NOT EXISTS minor_cannabinoids TEXT;
