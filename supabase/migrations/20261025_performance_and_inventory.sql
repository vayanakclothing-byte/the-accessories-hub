-- ============================================================================
-- The Accessories Hub — Migration: Performance Optimization & Complete Inventory
-- Migration Date: 2026-10-25
-- Adds: Product variants, audience, color, location, reserved stock,
--        stock movement reasons, and performance indexes.
-- ============================================================================

-- 1. Products columns for complete inventory and variants
alter table public.products add column if not exists color text default '';
alter table public.products add column if not exists audience text default 'unisex'; -- 'men', 'women', 'unisex'
alter table public.products add column if not exists variants jsonb default '[]'::jsonb; -- e.g. [{"type":"size","options":["6","7","8"]},{"type":"color","options":["Gold","Silver"]}]
alter table public.products add column if not exists location text default 'Main Warehouse';
alter table public.products add column if not exists supplier_id bigint references public.suppliers(id) on delete set null;
alter table public.products add column if not exists reserved_stock integer not null default 0;

-- 2. Stock History enhancements
alter table public.stock_history add column if not exists product_id bigint references public.products(id) on delete set null;
alter table public.stock_history add column if not exists reason text default '';
alter table public.stock_history add column if not exists user_email text default '';

-- 3. Performance Indexes for High-Velocity Queries
create index if not exists idx_products_sku on public.products (sku);
create index if not exists idx_products_in_stock on public.products (in_stock);
create index if not exists idx_products_is_archived on public.products (is_archived);
create index if not exists idx_products_category on public.products (category);
create index if not exists idx_products_price on public.products (price);
create index if not exists idx_orders_created_at on public.orders (created_at desc);
create index if not exists idx_orders_status on public.orders (status);
create index if not exists idx_stock_history_product_id on public.stock_history (product_id);
create index if not exists idx_stock_history_created_at on public.stock_history (created_at desc);
create index if not exists idx_expenses_date on public.expenses (date desc);
create index if not exists idx_notifications_is_read on public.notifications (is_read);

-- 4. Safe Archiving / Deactivation Helper Function
create or replace function public.archive_product(p_product_id bigint)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Unauthorized';
  end if;

  update public.products
  set is_archived = true, in_stock = false
  where id = p_product_id;

  return true;
end;
$$;
