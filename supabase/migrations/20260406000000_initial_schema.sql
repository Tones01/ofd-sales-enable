-- =============================================================================
-- Open Fields Sales Enablement — Initial Schema
-- =============================================================================
-- Tables: profiles, deals, sheets, sheet_deals, sheet_retailers, promotions
-- Views:  deal_availability
-- RPCs:   reserve_inventory, release_inventory, commit_inventory, fulfill_inventory
-- Auth:   RLS policies for admin / rep roles
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------------

-- Trigger function: keep updated_at current on every row update
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- PROFILES  (extends auth.users with a role field)
-- ---------------------------------------------------------------------------
-- NOTE: profiles is created before get_my_role() so PG15 can validate the
-- function body against the table at definition time.

CREATE TABLE public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT        NOT NULL DEFAULT 'rep' CHECK (role IN ('admin', 'rep')),
  full_name   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Security helper: returns the calling user's role.
-- Defined here (after profiles exists) so PG15 can validate the body.
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Auto-create a profile row whenever a new auth user is created.
-- Role and full_name are read from raw_user_meta_data if provided.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'rep'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: users read own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR get_my_role() = 'admin');

CREATE POLICY "profiles: users update own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "profiles: admins manage all"
  ON public.profiles FOR ALL
  USING (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- DEALS
-- ---------------------------------------------------------------------------
-- qty_total is the only stored quantity.
-- qty_available is computed in the deal_availability view.
-- ---------------------------------------------------------------------------

CREATE TABLE public.deals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lp_name             TEXT        NOT NULL,
  product_name        TEXT        NOT NULL,
  sku                 TEXT        NOT NULL,
  credit_description  TEXT        NOT NULL,
  qty_total           INTEGER     NOT NULL CHECK (qty_total > 0),
  status              TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX deals_status_idx ON public.deals (status);

CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

-- Reps can read active deals; admins see everything
CREATE POLICY "deals: authenticated read active"
  ON public.deals FOR SELECT
  USING (status = 'active' OR get_my_role() = 'admin');

CREATE POLICY "deals: admins insert"
  ON public.deals FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "deals: admins update"
  ON public.deals FOR UPDATE
  USING (get_my_role() = 'admin');

CREATE POLICY "deals: admins delete"
  ON public.deals FOR DELETE
  USING (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- SHEETS
-- ---------------------------------------------------------------------------

CREATE TABLE public.sheets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  created_by  UUID        NOT NULL REFERENCES public.profiles(id),
  status      TEXT        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'archived')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX sheets_created_by_idx ON public.sheets (created_by);
CREATE INDEX sheets_status_idx     ON public.sheets (status);

CREATE TRIGGER sheets_updated_at
  BEFORE UPDATE ON public.sheets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.sheets ENABLE ROW LEVEL SECURITY;

-- Reps see their own sheets; admins see all
CREATE POLICY "sheets: read own or admin"
  ON public.sheets FOR SELECT
  USING (created_by = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "sheets: reps insert own"
  ON public.sheets FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Reps can update their non-archived sheets; admins can update any
CREATE POLICY "sheets: update own or admin"
  ON public.sheets FOR UPDATE
  USING (
    (created_by = auth.uid() AND status != 'archived')
    OR get_my_role() = 'admin'
  );

CREATE POLICY "sheets: admins delete"
  ON public.sheets FOR DELETE
  USING (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- SHEET_DEALS  (sheet ↔ deal join; stores visible_qty per deal per sheet)
-- ---------------------------------------------------------------------------

CREATE TABLE public.sheet_deals (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id    UUID        NOT NULL REFERENCES public.sheets(id) ON DELETE CASCADE,
  deal_id     UUID        NOT NULL REFERENCES public.deals(id),
  visible_qty INTEGER     NOT NULL CHECK (visible_qty > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (sheet_id, deal_id)
);

CREATE INDEX sheet_deals_sheet_idx ON public.sheet_deals (sheet_id);
CREATE INDEX sheet_deals_deal_idx  ON public.sheet_deals (deal_id);

ALTER TABLE public.sheet_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sheet_deals: read own sheet or admin"
  ON public.sheet_deals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sheets s
      WHERE s.id = sheet_id
        AND (s.created_by = auth.uid() OR get_my_role() = 'admin')
    )
  );

CREATE POLICY "sheet_deals: insert on own draft sheet"
  ON public.sheet_deals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sheets s
      WHERE s.id = sheet_id
        AND s.created_by = auth.uid()
        AND s.status = 'draft'
    )
  );

CREATE POLICY "sheet_deals: update on own draft sheet"
  ON public.sheet_deals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sheets s
      WHERE s.id = sheet_id
        AND s.created_by = auth.uid()
        AND s.status = 'draft'
    )
  );

CREATE POLICY "sheet_deals: delete on own draft sheet"
  ON public.sheet_deals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sheets s
      WHERE s.id = sheet_id
        AND s.created_by = auth.uid()
        AND s.status = 'draft'
    )
  );

-- ---------------------------------------------------------------------------
-- SHEET_RETAILERS
-- ---------------------------------------------------------------------------
-- One row per (sheet, deal, retailer) allocation.
-- status lifecycle: pending → accepted | rejected
--                   accepted → fulfilled
-- Inventory is "held" while status IN ('pending','accepted','fulfilled').
-- ship_instructions are mandatory when accepting (enforced by RPC + constraint).
-- ---------------------------------------------------------------------------

CREATE TABLE public.sheet_retailers (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sheet_id          UUID        NOT NULL REFERENCES public.sheets(id) ON DELETE CASCADE,
  deal_id           UUID        NOT NULL REFERENCES public.deals(id),
  retailer_name     TEXT        NOT NULL,
  alloc_qty         INTEGER     NOT NULL CHECK (alloc_qty > 0),
  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'rejected', 'fulfilled')),
  ship_instructions TEXT,
  responded_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Shipping instructions are required once a retailer accepts
  CONSTRAINT ship_instructions_on_acceptance
    CHECK (status != 'accepted' OR (ship_instructions IS NOT NULL AND ship_instructions != ''))
);

CREATE INDEX sheet_retailers_sheet_idx  ON public.sheet_retailers (sheet_id);
CREATE INDEX sheet_retailers_deal_idx   ON public.sheet_retailers (deal_id);
CREATE INDEX sheet_retailers_status_idx ON public.sheet_retailers (status);

CREATE TRIGGER sheet_retailers_updated_at
  BEFORE UPDATE ON public.sheet_retailers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.sheet_retailers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sheet_retailers: read own sheet or admin"
  ON public.sheet_retailers FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sheets s
      WHERE s.id = sheet_id
        AND (s.created_by = auth.uid() OR get_my_role() = 'admin')
    )
  );

CREATE POLICY "sheet_retailers: insert on own sheet"
  ON public.sheet_retailers FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sheets s
      WHERE s.id = sheet_id
        AND s.created_by = auth.uid()
    )
  );

CREATE POLICY "sheet_retailers: update on own sheet or admin"
  ON public.sheet_retailers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.sheets s
      WHERE s.id = sheet_id
        AND (s.created_by = auth.uid() OR get_my_role() = 'admin')
    )
  );

CREATE POLICY "sheet_retailers: admins delete"
  ON public.sheet_retailers FOR DELETE
  USING (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- PROMOTIONS
-- ---------------------------------------------------------------------------
-- Standalone portfolio promotion records. No inventory reservation logic.
-- ---------------------------------------------------------------------------

CREATE TABLE public.promotions (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name            TEXT        NOT NULL,
  lp_name                 TEXT        NOT NULL,
  mechanism_description   TEXT        NOT NULL,
  start_date              DATE        NOT NULL,
  end_date                DATE,
  units_sold              INTEGER     NOT NULL DEFAULT 0 CHECK (units_sold >= 0),
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT end_after_start CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TRIGGER promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "promotions: all authenticated can read"
  ON public.promotions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "promotions: admins insert"
  ON public.promotions FOR INSERT
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "promotions: admins update"
  ON public.promotions FOR UPDATE
  USING (get_my_role() = 'admin');

CREATE POLICY "promotions: admins delete"
  ON public.promotions FOR DELETE
  USING (get_my_role() = 'admin');

-- ---------------------------------------------------------------------------
-- VIEW: deal_availability
-- ---------------------------------------------------------------------------
-- Computes live inventory counts from sheet_retailers.
-- qty_available = qty_total − qty_reserved − qty_accepted − qty_fulfilled
-- (rejected rows do NOT count against available)
-- ---------------------------------------------------------------------------

CREATE VIEW public.deal_availability AS
SELECT
  d.id,
  d.lp_name,
  d.product_name,
  d.sku,
  d.credit_description,
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

-- ---------------------------------------------------------------------------
-- RPC: reserve_inventory(sheet_id)
-- ---------------------------------------------------------------------------
-- Called when a rep sends a sheet.
-- Acquires FOR UPDATE locks on each deal in consistent order (prevents deadlocks),
-- then validates that this sheet's pending allocations fit within available qty.
-- If all checks pass, marks the sheet as 'sent'.
-- Raises an exception (rolling back the transaction) on over-allocation.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION reserve_inventory(p_sheet_id UUID)
RETURNS VOID AS $$
DECLARE
  rec         RECORD;
  v_available INTEGER;
BEGIN
  -- Guard: sheet must be in draft status
  IF NOT EXISTS (
    SELECT 1 FROM public.sheets WHERE id = p_sheet_id AND status = 'draft'
  ) THEN
    RAISE EXCEPTION 'reserve_inventory: sheet % is not in draft status', p_sheet_id;
  END IF;

  -- Guard: sheet must have at least one pending retailer allocation
  IF NOT EXISTS (
    SELECT 1 FROM public.sheet_retailers
    WHERE sheet_id = p_sheet_id AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'reserve_inventory: sheet % has no pending retailer allocations', p_sheet_id;
  END IF;

  -- Lock each deal involved in this sheet (consistent ORDER BY prevents deadlocks)
  -- and validate that available inventory covers this sheet's allocations.
  FOR rec IN
    SELECT
      sr.deal_id,
      SUM(sr.alloc_qty)::INTEGER AS this_sheet_total
    FROM public.sheet_retailers sr
    WHERE sr.sheet_id = p_sheet_id
      AND sr.status = 'pending'
    GROUP BY sr.deal_id
    ORDER BY sr.deal_id  -- deterministic lock acquisition order
  LOOP
    -- Acquire exclusive row lock on the deal
    PERFORM id FROM public.deals WHERE id = rec.deal_id FOR UPDATE;

    -- Compute qty available to this sheet:
    --   qty_total − all active allocs from OTHER sheets
    SELECT (
      d.qty_total
      - COALESCE(
          SUM(sr2.alloc_qty) FILTER (
            WHERE sr2.status IN ('pending', 'accepted', 'fulfilled')
              AND sr2.sheet_id != p_sheet_id
          ),
          0
        )
    )::INTEGER
    INTO v_available
    FROM public.deals d
    LEFT JOIN public.sheet_retailers sr2 ON sr2.deal_id = d.id
    WHERE d.id = rec.deal_id
    GROUP BY d.qty_total;

    IF v_available IS NULL OR v_available < rec.this_sheet_total THEN
      RAISE EXCEPTION
        'reserve_inventory: insufficient inventory for deal %. Available: %, Requested: %',
        rec.deal_id,
        COALESCE(v_available, 0),
        rec.this_sheet_total;
    END IF;
  END LOOP;

  -- All deals validated — mark the sheet as sent
  UPDATE public.sheets
  SET status = 'sent', updated_at = NOW()
  WHERE id = p_sheet_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reserve_inventory(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: release_inventory(sheet_retailer_id)
-- ---------------------------------------------------------------------------
-- Retailer rejects. Marks the row as 'rejected', which removes those units
-- from the allocated total and returns them to available.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION release_inventory(p_sheet_retailer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.sheet_retailers
  WHERE id = p_sheet_retailer_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'release_inventory: sheet_retailer % not found', p_sheet_retailer_id;
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION
      'release_inventory: sheet_retailer % must be pending to release (current: %)',
      p_sheet_retailer_id, v_status;
  END IF;

  UPDATE public.sheet_retailers
  SET
    status       = 'rejected',
    responded_at = NOW(),
    updated_at   = NOW()
  WHERE id = p_sheet_retailer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION release_inventory(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: commit_inventory(sheet_retailer_id, ship_instructions)
-- ---------------------------------------------------------------------------
-- Retailer accepts. Moves units from pending (reserved) to accepted (committed).
-- Shipping instructions are required and stored on the row.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION commit_inventory(
  p_sheet_retailer_id UUID,
  p_ship_instructions TEXT
)
RETURNS VOID AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.sheet_retailers
  WHERE id = p_sheet_retailer_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'commit_inventory: sheet_retailer % not found', p_sheet_retailer_id;
  END IF;

  IF v_status != 'pending' THEN
    RAISE EXCEPTION
      'commit_inventory: sheet_retailer % must be pending to commit (current: %)',
      p_sheet_retailer_id, v_status;
  END IF;

  IF p_ship_instructions IS NULL OR TRIM(p_ship_instructions) = '' THEN
    RAISE EXCEPTION 'commit_inventory: shipping instructions are required on acceptance';
  END IF;

  UPDATE public.sheet_retailers
  SET
    status            = 'accepted',
    ship_instructions = p_ship_instructions,
    responded_at      = NOW(),
    updated_at        = NOW()
  WHERE id = p_sheet_retailer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION commit_inventory(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC: fulfill_inventory(sheet_retailer_id)
-- ---------------------------------------------------------------------------
-- Order shipped. Moves units from accepted to fulfilled.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION fulfill_inventory(p_sheet_retailer_id UUID)
RETURNS VOID AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.sheet_retailers
  WHERE id = p_sheet_retailer_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'fulfill_inventory: sheet_retailer % not found', p_sheet_retailer_id;
  END IF;

  IF v_status != 'accepted' THEN
    RAISE EXCEPTION
      'fulfill_inventory: sheet_retailer % must be accepted to fulfill (current: %)',
      p_sheet_retailer_id, v_status;
  END IF;

  UPDATE public.sheet_retailers
  SET
    status     = 'fulfilled',
    updated_at = NOW()
  WHERE id = p_sheet_retailer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION fulfill_inventory(UUID) TO authenticated;
