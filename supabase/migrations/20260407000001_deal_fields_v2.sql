-- Align deals table with business field requirements
ALTER TABLE public.deals
  ADD COLUMN IF NOT EXISTS brand      TEXT,
  ADD COLUMN IF NOT EXISTS format     TEXT,
  ADD COLUMN IF NOT EXISTS sale_price NUMERIC(10, 2);

-- credit_description is now optional (not all deals have a credit memo)
ALTER TABLE public.deals
  ALTER COLUMN credit_description DROP NOT NULL;
