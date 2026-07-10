-- Migration 0003: Add performance indexes for common multi-tenant queries

CREATE INDEX IF NOT EXISTS "orders_restaurant_status_idx" ON "orders" ("restaurant_id", "status");
CREATE INDEX IF NOT EXISTS "orders_restaurant_created_at_idx" ON "orders" ("restaurant_id", "created_at");

CREATE INDEX IF NOT EXISTS "bills_restaurant_status_idx" ON "bills" ("restaurant_id", "status");
CREATE INDEX IF NOT EXISTS "bills_restaurant_closed_at_idx" ON "bills" ("restaurant_id", "closed_at");

CREATE INDEX IF NOT EXISTS "users_restaurant_active_idx" ON "users" ("restaurant_id", "active");

CREATE INDEX IF NOT EXISTS "menu_items_restaurant_available_idx" ON "menu_items" ("restaurant_id", "available");
