CREATE TABLE public.product_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  size text NOT NULL DEFAULT '',
  loyverse_variant_id text NOT NULL UNIQUE,
  in_stock integer NOT NULL DEFAULT 0,
  synced_at timestamptz,
  UNIQUE (product_id, size)
);
GRANT SELECT ON public.product_stock TO anon, authenticated;
GRANT ALL ON public.product_stock TO service_role;
ALTER TABLE public.product_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Stock is public" ON public.product_stock FOR SELECT TO anon, authenticated USING (true);