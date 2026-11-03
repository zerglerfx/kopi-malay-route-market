CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.categories FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  price numeric(10,2) NOT NULL,
  sale_price numeric(10,2),
  category_id uuid NOT NULL REFERENCES public.categories(id),
  images text[] NOT NULL DEFAULT '{}',
  variants jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_featured boolean NOT NULL DEFAULT false,
  stock_qty int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.products TO anon, authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Products are public" ON public.products FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  session_id text,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  selected_variant text NOT NULL DEFAULT '',
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX cart_items_user_product_variant ON public.cart_items (user_id, product_id, selected_variant);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own cart select" ON public.cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own cart insert" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own cart update" ON public.cart_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own cart delete" ON public.cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid,
  guest_email text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  subtotal numeric(10,2) NOT NULL,
  shipping_fee numeric(10,2) NOT NULL,
  total_amount numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_method text NOT NULL DEFAULT 'Stripe',
  stripe_session_id text,
  stripe_payment_intent_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  selected_variant text NOT NULL DEFAULT '',
  unit_price numeric(10,2) NOT NULL,
  quantity int NOT NULL
);
GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Own order items" ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.user_id = auth.uid()));

INSERT INTO public.categories (name, slug, sort_order) VALUES
 ('Shirts','shirts',1),('Sweaters & Jackets','sweaters-jackets',2),('Stickers','stickers',3),('Tumblers','tumblers',4),('Other Merch','other-merch',5);

WITH c AS (SELECT id, slug FROM public.categories)
INSERT INTO public.products (name, slug, description, price, sale_price, category_id, images, variants, is_featured, stock_qty)
SELECT p.name, p.slug, p.description, p.price, p.sale_price, c.id, p.images, p.variants::jsonb, p.featured, p.stock
FROM (VALUES
 ('Route 1 Kopi Curves Tee','route-1-kopi-curves-tee','Heavyweight black cotton tee with the Route 1 mountain road and kopi cup line art. Pre-shrunk, made for long days in the saddle.',79,59,'shirts',ARRAY['tee','tee-back'],'{"sizes":["S","M","L","XL","XXL"]}',true,120),
 ('Mae Hong Son Loop 1864 Tee','mae-hong-son-loop-tee','Commemorate the legendary 1,864 curves loop. Soft-washed tee with front chest badge print.',85,NULL,'shirts',ARRAY['tee','tee-back'],'{"sizes":["S","M","L","XL"]}',true,80),
 ('Kopi Malay Rider Tee - Cream','kopi-malay-rider-tee-cream','Cream colourway tee with blue and red rider badge. Breathable for tropical rides.',75,NULL,'shirts',ARRAY['tee-back','tee'],'{"sizes":["S","M","L","XL","XXL"]}',false,60),
 ('Route 1 Riding Jacket','route-1-riding-jacket','Textile riding jacket with armour pockets, reflective strips and embroidered Route 1 and Kopi Malay badges.',599,499,'sweaters-jackets',ARRAY['jacket','hoodie'],'{"sizes":["S","M","L","XL","XXL"]}',true,25),
 ('Highlands Windbreaker','highlands-windbreaker','Packable lightweight windbreaker for misty Cameron Highlands mornings.',229,NULL,'sweaters-jackets',ARRAY['jacket'],'{"sizes":["S","M","L","XL"]}',false,40),
 ('Kopi Malay Pullover Hoodie','kopi-malay-pullover-hoodie','Brushed fleece hoodie with Route 1 shield print. Warm on night rides and cold-brew runs.',189,159,'sweaters-jackets',ARRAY['hoodie'],'{"sizes":["S","M","L","XL","XXL"]}',true,50),
 ('Mae Hong Son 1864 Curves Sticker','mae-hong-son-1864-sticker','Weatherproof vinyl sticker for helmets, tank bags and tumblers. 10cm.',12,NULL,'stickers',ARRAY['sticker'],'{}',true,500),
 ('Route 1 Curve Badge Sticker Set','route-1-curve-badge-set','Set of 6 die-cut curve warning badges in yellow, blue and red. UV-resistant.',29,24,'stickers',ARRAY['sticker'],'{}',false,300),
 ('Kopi Malay Logo Sticker','kopi-malay-logo-sticker','Classic round Kopi Malay logo sticker. 8cm.',8,NULL,'stickers',ARRAY['sticker'],'{}',false,500),
 ('Route 1 Insulated Tumbler 500ml','route-1-tumbler-500','Double-wall stainless tumbler keeps kopi hot for 12 hours. Fits most bike cup holders.',89,69,'tumblers',ARRAY['tumbler'],'{}',true,90),
 ('Kopi Malay Travel Tumbler 750ml','kopi-malay-tumbler-750','Big-capacity travel tumbler with leak-proof lid for long-haul days.',109,NULL,'tumblers',ARRAY['tumbler'],'{}',false,70),
 ('Camp Enamel Mug','camp-enamel-mug','Classic enamel camp mug with Route 1 road print. Perfect for roadside kopi stops.',45,NULL,'tumblers',ARRAY['mug'],'{}',false,100),
 ('Route 1 Rider Cap','route-1-rider-cap','Six-panel cap with embroidered Route 1 badge. Adjustable strap.',69,NULL,'other-merch',ARRAY['cap'],'{}',true,80),
 ('Embroidered Badge Patch Set','embroidered-badge-patch-set','Three iron-on patches: Route 1 shield, Kopi Malay cup, and 1864 Curves.',39,NULL,'other-merch',ARRAY['patch'],'{}',false,150),
 ('Curves Metal Keychain','curves-metal-keychain','Enamel-filled metal keychain shaped like a curve warning sign.',25,19,'other-merch',ARRAY['patch'],'{}',false,200),
 ('Kopi Malay Bandana Neck Tube','kopi-malay-neck-tube','Stretch neck tube for sun and dust protection with Route 1 pattern.',35,NULL,'other-merch',ARRAY['cap'],'{}',false,120)
) AS p(name, slug, description, price, sale_price, cat, images, variants, featured, stock)
JOIN c ON c.slug = p.cat;