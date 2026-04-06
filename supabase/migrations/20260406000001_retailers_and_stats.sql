-- =============================================================================
-- Open Fields — Migration 2: Retailers table, stats views, CSV import prep
-- =============================================================================

-- ---------------------------------------------------------------------------
-- RETAILERS  (proper entity — replaces free-text retailer_name)
-- ---------------------------------------------------------------------------

CREATE TABLE public.retailers (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  license_number  TEXT,                          -- cannabis retail licence
  address         TEXT,
  city            TEXT,
  province        TEXT        CHECK (province IN ('AB','BC','MB','NB','NL','NS','NT','NU','ON','PE','QC','SK','YT')),
  postal_code     TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  account_rep_id  UUID        REFERENCES public.profiles(id),  -- assigned OFD rep
  status          TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX retailers_status_idx      ON public.retailers (status);
CREATE INDEX retailers_account_rep_idx ON public.retailers (account_rep_id);

CREATE TRIGGER retailers_updated_at
  BEFORE UPDATE ON public.retailers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.retailers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retailers: all authenticated can read active"
  ON public.retailers FOR SELECT
  USING (status = 'active' OR get_my_role() = 'admin');

CREATE POLICY "retailers: admins insert"
  ON public.retailers FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "retailers: admins update"
  ON public.retailers FOR UPDATE
  USING (get_my_role() = 'admin');

CREATE POLICY "retailers: admins delete"
  ON public.retailers FOR DELETE
  USING (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- Link sheet_retailers → retailers
-- retailer_id is nullable so existing rows (seeded with retailer_name) still work.
-- Going forward the app should always set retailer_id.
-- ---------------------------------------------------------------------------

ALTER TABLE public.sheet_retailers
  ADD COLUMN retailer_id UUID REFERENCES public.retailers(id);

CREATE INDEX sheet_retailers_retailer_idx ON public.sheet_retailers (retailer_id);

-- ---------------------------------------------------------------------------
-- VIEW: rep_stats
-- One row per rep — units, acceptance rate, sheet activity
-- ---------------------------------------------------------------------------

CREATE VIEW public.rep_stats AS
SELECT
  p.id                                                                      AS rep_id,
  p.full_name,
  COUNT(DISTINCT s.id)                                                      AS sheets_total,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'sent')                    AS sheets_sent,
  COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'archived')                AS sheets_archived,
  COUNT(sr.id)                                                              AS allocations_total,
  COUNT(sr.id) FILTER (WHERE sr.status = 'pending')                        AS allocations_pending,
  COUNT(sr.id) FILTER (WHERE sr.status = 'accepted')                       AS allocations_accepted,
  COUNT(sr.id) FILTER (WHERE sr.status = 'rejected')                       AS allocations_rejected,
  COUNT(sr.id) FILTER (WHERE sr.status = 'fulfilled')                      AS allocations_fulfilled,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'accepted'),  0)    AS units_accepted,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'fulfilled'), 0)    AS units_fulfilled,
  ROUND(
    COUNT(sr.id) FILTER (WHERE sr.status = 'accepted')::NUMERIC
    / NULLIF(COUNT(sr.id) FILTER (WHERE sr.status IN ('accepted', 'rejected')), 0) * 100,
    1
  )                                                                         AS acceptance_rate_pct
FROM public.profiles p
LEFT JOIN public.sheets s          ON s.created_by = p.id
LEFT JOIN public.sheet_retailers sr ON sr.sheet_id  = s.id
WHERE p.role = 'rep'
GROUP BY p.id, p.full_name;

GRANT SELECT ON public.rep_stats TO authenticated;

-- ---------------------------------------------------------------------------
-- VIEW: retailer_stats
-- One row per retailer — lifetime totals and acceptance rate
-- ---------------------------------------------------------------------------

CREATE VIEW public.retailer_stats AS
SELECT
  r.id,
  r.name,
  r.city,
  r.province,
  r.account_rep_id,
  p.full_name                                                               AS account_rep_name,
  COUNT(sr.id)                                                              AS allocations_total,
  COUNT(sr.id) FILTER (WHERE sr.status = 'accepted')                       AS allocations_accepted,
  COUNT(sr.id) FILTER (WHERE sr.status = 'rejected')                       AS allocations_rejected,
  COUNT(sr.id) FILTER (WHERE sr.status = 'fulfilled')                      AS allocations_fulfilled,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status IN ('accepted', 'fulfilled')), 0) AS units_committed,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'fulfilled'), 0)    AS units_fulfilled,
  ROUND(
    COUNT(sr.id) FILTER (WHERE sr.status = 'accepted')::NUMERIC
    / NULLIF(COUNT(sr.id) FILTER (WHERE sr.status IN ('accepted', 'rejected')), 0) * 100,
    1
  )                                                                         AS acceptance_rate_pct,
  MAX(sr.responded_at)                                                      AS last_response_at
FROM public.retailers r
LEFT JOIN public.profiles p          ON p.id          = r.account_rep_id
LEFT JOIN public.sheet_retailers sr  ON sr.retailer_id = r.id
GROUP BY r.id, r.name, r.city, r.province, r.account_rep_id, p.full_name;

GRANT SELECT ON public.retailer_stats TO authenticated;

-- ---------------------------------------------------------------------------
-- VIEW: retailer_purchase_history
-- Every accepted/fulfilled allocation for a retailer with deal detail
-- ---------------------------------------------------------------------------

CREATE VIEW public.retailer_purchase_history AS
SELECT
  r.id                    AS retailer_id,
  r.name                  AS retailer_name,
  r.city,
  r.province,
  sr.id                   AS allocation_id,
  sr.sheet_id,
  sh.name                 AS sheet_name,
  d.lp_name,
  d.product_name,
  d.sku,
  d.credit_description,
  sr.alloc_qty,
  sr.status,
  sr.ship_instructions,
  sr.responded_at,
  p.full_name             AS rep_name,
  sr.created_at
FROM public.retailers r
JOIN public.sheet_retailers sr  ON sr.retailer_id = r.id
JOIN public.deals d             ON d.id           = sr.deal_id
JOIN public.sheets sh           ON sh.id          = sr.sheet_id
JOIN public.profiles p          ON p.id           = sh.created_by
WHERE sr.status IN ('accepted', 'fulfilled')
ORDER BY sr.responded_at DESC;

GRANT SELECT ON public.retailer_purchase_history TO authenticated;

-- ---------------------------------------------------------------------------
-- VIEW: lp_deal_stats
-- Per-LP summary — useful for reporting back to LPs
-- ---------------------------------------------------------------------------

CREATE VIEW public.lp_deal_stats AS
SELECT
  d.lp_name,
  COUNT(DISTINCT d.id)                                                            AS deals_total,
  COUNT(DISTINCT d.id) FILTER (WHERE d.status = 'active')                        AS deals_active,
  SUM(d.qty_total)                                                                AS units_total,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'pending'),   0)          AS units_reserved,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'accepted'),  0)          AS units_accepted,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'fulfilled'), 0)          AS units_fulfilled,
  COALESCE(SUM(sr.alloc_qty) FILTER (WHERE sr.status = 'rejected'),  0)          AS units_rejected
FROM public.deals d
LEFT JOIN public.sheet_retailers sr ON sr.deal_id = d.id
GROUP BY d.lp_name
ORDER BY d.lp_name;

GRANT SELECT ON public.lp_deal_stats TO authenticated;
