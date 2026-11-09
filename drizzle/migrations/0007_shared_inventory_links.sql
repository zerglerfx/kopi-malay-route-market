CREATE TABLE public.shared_stock_links (
 product_id uuid PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
 loyverse_variant_id text NOT NULL REFERENCES public.product_stock(loyverse_variant_id) ON UPDATE CASCADE ON DELETE CASCADE
);
GRANT SELECT ON public.shared_stock_links TO anon, authenticated;
GRANT ALL ON public.shared_stock_links TO service_role;
ALTER TABLE public.shared_stock_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shared inventory mappings are public" ON public.shared_stock_links FOR SELECT TO anon, authenticated USING (true);
COMMENT ON TABLE public.shared_stock_links IS 'Additional one-size products sharing a canonical product_stock Loyverse inventory pool; deduct quantities once per variant.';