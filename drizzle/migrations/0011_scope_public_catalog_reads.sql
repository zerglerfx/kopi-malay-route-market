DROP POLICY IF EXISTS "Products are public" ON public.products;
CREATE POLICY "Active products are public" ON public.products FOR SELECT TO anon, authenticated USING (is_active);

DROP POLICY IF EXISTS "Categories are public" ON public.categories;
CREATE POLICY "Categories with active products are public" ON public.categories FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.category_id = categories.id AND p.is_active));

DROP POLICY IF EXISTS "Stock is public" ON public.product_stock;
CREATE POLICY "Stock of active products is public" ON public.product_stock FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_stock.product_id AND p.is_active));

DROP POLICY IF EXISTS "Shared inventory mappings are public" ON public.shared_stock_links;
CREATE POLICY "Shared mappings of active products are public" ON public.shared_stock_links FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.products p WHERE p.id = shared_stock_links.product_id AND p.is_active));