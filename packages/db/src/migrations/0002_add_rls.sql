-- Migration 0002: Enable Row Level Security for multi-tenant isolation
-- Each restaurant sees only its own data via app.current_restaurant_id session variable.

-- ============================================================
-- 1. Enable RLS on all tenant-scoped tables
-- ============================================================

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 2. RLS policies — restaurant_isolation
--
-- Pattern: each table either has restaurant_id directly, or
-- is accessed via a parent join. We use USING clauses only
-- (no separate WITH CHECK — the USING clause also applies to
-- INSERT/UPDATE checks in PostgreSQL 9.5+).
-- ============================================================

-- Idempotenza: rimuovi le policy se già presenti (es. ri-applicazione su DB vecchio).
DROP POLICY IF EXISTS restaurant_isolation ON restaurants;
DROP POLICY IF EXISTS restaurant_isolation ON users;
DROP POLICY IF EXISTS restaurant_isolation ON sessions;
DROP POLICY IF EXISTS restaurant_isolation ON menus;
DROP POLICY IF EXISTS restaurant_isolation ON menu_sections;
DROP POLICY IF EXISTS restaurant_isolation ON menu_items;
DROP POLICY IF EXISTS restaurant_isolation ON item_variants;
DROP POLICY IF EXISTS restaurant_isolation ON rooms;
DROP POLICY IF EXISTS restaurant_isolation ON tables;
DROP POLICY IF EXISTS restaurant_isolation ON orders;
DROP POLICY IF EXISTS restaurant_isolation ON order_items;
DROP POLICY IF EXISTS restaurant_isolation ON order_status_history;
DROP POLICY IF EXISTS restaurant_isolation ON bills;
DROP POLICY IF EXISTS restaurant_isolation ON bill_payments;
DROP POLICY IF EXISTS restaurant_isolation ON inventory_items;
DROP POLICY IF EXISTS restaurant_isolation ON inventory_movements;

-- restaurants: owner table — id IS the restaurant_id
CREATE POLICY restaurant_isolation ON restaurants
  USING (id = current_setting('app.current_restaurant_id', true)::uuid);

-- users
CREATE POLICY restaurant_isolation ON users
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid);

-- sessions: owned via user → restaurant chain
-- For simplicity, allow if the session's user belongs to the restaurant.
-- We join via EXISTS to keep the policy self-contained.
CREATE POLICY restaurant_isolation ON sessions
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = sessions.user_id
        AND u.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
    )
  );

-- menus
CREATE POLICY restaurant_isolation ON menus
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid);

-- menu_sections: owned via menu → restaurant
CREATE POLICY restaurant_isolation ON menu_sections
  USING (
    EXISTS (
      SELECT 1 FROM menus m
      WHERE m.id = menu_sections.menu_id
        AND m.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
    )
  );

-- menu_items: has direct restaurant_id column
CREATE POLICY restaurant_isolation ON menu_items
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid);

-- item_variants: owned via menu_item → restaurant
CREATE POLICY restaurant_isolation ON item_variants
  USING (
    EXISTS (
      SELECT 1 FROM menu_items mi
      WHERE mi.id = item_variants.item_id
        AND mi.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
    )
  );

-- rooms
CREATE POLICY restaurant_isolation ON rooms
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid);

-- tables
CREATE POLICY restaurant_isolation ON tables
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid);

-- orders
CREATE POLICY restaurant_isolation ON orders
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid);

-- order_items: owned via order → restaurant
CREATE POLICY restaurant_isolation ON order_items
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND o.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
    )
  );

-- order_status_history: owned via order → restaurant
CREATE POLICY restaurant_isolation ON order_status_history
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_status_history.order_id
        AND o.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
    )
  );

-- bills
CREATE POLICY restaurant_isolation ON bills
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid);

-- bill_payments: owned via bill → restaurant
CREATE POLICY restaurant_isolation ON bill_payments
  USING (
    EXISTS (
      SELECT 1 FROM bills b
      WHERE b.id = bill_payments.bill_id
        AND b.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
    )
  );

-- inventory_items
CREATE POLICY restaurant_isolation ON inventory_items
  USING (restaurant_id = current_setting('app.current_restaurant_id', true)::uuid);

-- inventory_movements: owned via inventory_item → restaurant
CREATE POLICY restaurant_isolation ON inventory_movements
  USING (
    EXISTS (
      SELECT 1 FROM inventory_items ii
      WHERE ii.id = inventory_movements.item_id
        AND ii.restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
    )
  );

-- ============================================================
-- 3. Application role (non-superuser)
--    The app connects as tako_app; superuser bypasses RLS.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tako_app') THEN
    CREATE ROLE tako_app LOGIN PASSWORD 'change_in_production';
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tako_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tako_app;

-- Ensure future tables also grant to tako_app
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tako_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO tako_app;
