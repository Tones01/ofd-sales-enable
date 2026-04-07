-- Add extra fields to deals table
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS category       TEXT,
  ADD COLUMN IF NOT EXISTS list_price     NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS deal_expiry    DATE,
  ADD COLUMN IF NOT EXISTS notes         TEXT;
