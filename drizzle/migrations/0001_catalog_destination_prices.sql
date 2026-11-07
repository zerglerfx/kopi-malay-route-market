ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_thb numeric(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'myr';
COMMENT ON COLUMN public.products.is_active IS 'Retired placeholder products are preserved for historical order references but excluded from the storefront.';