-- =============================================================================
-- Open Fields Sales Enablement — Seed Data
-- =============================================================================
-- Creates 3 test users (1 admin, 2 reps), 3 deals, 2 sheets with sheet_deals
-- and sheet_retailers in various statuses, and 2 portfolio promotions.
--
-- Run via:  supabase db reset   (applies migrations + seed)
--       or  psql ... < supabase/seed.sql
--
-- Fixed UUIDs are used throughout so the seed is idempotent.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TEST USERS  (inserted directly into auth.users; profiles created by trigger)
-- ---------------------------------------------------------------------------

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, aud, role
)
VALUES
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@openfields.ca',
    crypt('OpenFields2026!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"admin","full_name":"Jordan (Admin)"}',
    false, 'authenticated', 'authenticated'
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'alice@openfields.ca',
    crypt('OpenFields2026!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"rep","full_name":"Alice Nguyen"}',
    false, 'authenticated', 'authenticated'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'bob@openfields.ca',
    crypt('OpenFields2026!', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"role":"rep","full_name":"Bob Tremblay"}',
    false, 'authenticated', 'authenticated'
  )
ON CONFLICT (id) DO NOTHING;

-- Ensure roles are set correctly (trigger may have already run, this is a safety net)
UPDATE public.profiles SET role = 'admin', full_name = 'Jordan (Admin)' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.profiles SET role = 'rep',   full_name = 'Alice Nguyen'    WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE public.profiles SET role = 'rep',   full_name = 'Bob Tremblay'    WHERE id = '00000000-0000-0000-0000-000000000003';

-- ---------------------------------------------------------------------------
-- DEALS  (3 active LP deals)
-- ---------------------------------------------------------------------------

INSERT INTO public.deals (id, lp_name, product_name, sku, credit_description, qty_total, status)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    'Auxly Cannabis',
    'Kolab Project 28g Indica',
    'AUX-KLP-28-IND',
    '$2.00/unit markdown on 90-day aged 28g flower — credit applied to invoice',
    500,
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    'Organigram',
    'SHRED X 3.5g Hybrid',
    'OGI-SHX-35-HYB',
    '$1.50/unit credit — aged inventory clearance, expires end of month',
    750,
    'active'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    'Sundial Growers',
    'Top Leaf 7g Sativa',
    'SND-TL-7-SAT',
    '$3.00/unit markdown + 10% bundle credit on orders of 50+ units',
    300,
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- SHEETS
-- ---------------------------------------------------------------------------
-- Sheet 1: sent (Alice's April Week 1 — covers Auxly + Organigram deals)
-- Sheet 2: draft (Bob's April Week 2 — covers Sundial deal)
-- ---------------------------------------------------------------------------

INSERT INTO public.sheets (id, name, created_by, status)
VALUES
  (
    '20000000-0000-0000-0000-000000000001',
    'April Week 1 — Auxly + Organigram',
    '00000000-0000-0000-0000-000000000002',  -- Alice
    'sent'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'April Week 2 — Sundial',
    '00000000-0000-0000-0000-000000000003',  -- Bob
    'draft'
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- SHEET_DEALS  (which deals are on each sheet + visible_qty per deal)
-- ---------------------------------------------------------------------------

INSERT INTO public.sheet_deals (id, sheet_id, deal_id, visible_qty)
VALUES
  -- Sheet 1 includes Auxly (200 units visible) and Organigram (300 units visible)
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 200),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 300),
  -- Sheet 2 includes Sundial (150 units visible)
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 150)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- SHEET_RETAILERS  (retailer responses in various statuses)
-- ---------------------------------------------------------------------------
--
-- Sheet 1 / Auxly deal:
--   GreenLeaf Dispensary  → accepted  (80 units, ship instructions logged)
--   Canna Corner          → rejected  (60 units released back to available)
--
-- Sheet 1 / Organigram deal:
--   The Herb Shop         → pending   (120 units still reserved)
--   Bloom Wellness        → fulfilled (90 units shipped)
--
-- Sheet 2 / Sundial deal (draft sheet — 2 pending retailers):
--   Pacific Provisions    → pending   (75 units)
--   Rocky Mountain Cannabis → pending (50 units)
-- ---------------------------------------------------------------------------

INSERT INTO public.sheet_retailers (
  id, sheet_id, deal_id, retailer_name,
  alloc_qty, status, ship_instructions, responded_at
)
VALUES
  -- Auxly: accepted
  (
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'GreenLeaf Dispensary',
    80, 'accepted',
    'Ship to 123 Main St, Vancouver BC V6B 1A1. Attn: Receiving Dept. Split across 2 pallets. PO# GL-2026-041.',
    NOW() - INTERVAL '2 days'
  ),
  -- Auxly: rejected (units returned to available)
  (
    '40000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'Canna Corner',
    60, 'rejected',
    NULL,
    NOW() - INTERVAL '1 day'
  ),
  -- Organigram: pending (awaiting retailer response)
  (
    '40000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'The Herb Shop',
    120, 'pending',
    NULL,
    NULL
  ),
  -- Organigram: fulfilled (shipped)
  (
    '40000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'Bloom Wellness',
    90, 'fulfilled',
    'Ship to 456 Oak Ave, Calgary AB T2P 3G8. Consolidated single pallet. PO# BW-2026-089. Contact: receiving@bloomwellness.ca.',
    NOW() - INTERVAL '5 days'
  ),
  -- Sundial: pending (draft sheet, not yet sent)
  (
    '40000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'Pacific Provisions',
    75, 'pending',
    NULL,
    NULL
  ),
  (
    '40000000-0000-0000-0000-000000000006',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    'Rocky Mountain Cannabis',
    50, 'pending',
    NULL,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PROMOTIONS  (2 active portfolio promos — no inventory logic)
-- ---------------------------------------------------------------------------

INSERT INTO public.promotions (
  id, partner_name, lp_name, mechanism_description,
  start_date, end_date, units_sold, notes
)
VALUES
  (
    '50000000-0000-0000-0000-000000000001',
    'BudNked',
    'Cannaba',
    'BudNked x Cannaba $1.00/unit co-promo on all 3.5g SKUs sold through OFD — joint marketing fund credited to OFD monthly via AR memo',
    '2026-01-01',
    '2026-06-30',
    1240,
    'Reconcile units with Cannaba AR by last business day of each month. Promo contact: promo@cannaba.ca. Running credit memo #CM-2026-007.'
  ),
  (
    '50000000-0000-0000-0000-000000000002',
    'Leafly',
    'Auxly Cannabis',
    'Leafly featured placement promo — $0.50/unit on Kolab 28g sold through OFD channel during campaign window; Leafly confirms units monthly via dashboard export',
    '2026-03-01',
    '2026-05-31',
    380,
    'Units reported from OFD weekly sales file. Leafly reconciles by the 5th of each following month. Campaign ID: LFY-CA-2026-Q1-AUX.'
  )
ON CONFLICT (id) DO NOTHING;
