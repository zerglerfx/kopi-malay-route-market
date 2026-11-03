# Kopi Malay - Route 1 Official Merchandise

## Look and feel
- Palette "Badge Blue/Red": ink #101418, cream #f4f1ea, road-sign blue #1d4ed8, badge red #d62828 (yellow accent used sparingly for "curve" badges). Dark header/footer, cream content, thin card borders, crisp sharp-ish radius.
- Fonts: Space Grotesk (headings, uppercase labels), DM Sans (body).
- Mobile-first; 2-column product grid on phones, 3-4 on desktop.

## Pages
- `/` Home: hero (rider on mountain road + kopi), featured categories, best sellers, story strip.
- `/shop` Shop All with category tabs (All, Shirts, Sweaters & Jackets, Stickers, Tumblers, Other Merch) and sort; search via `?q=`.
- `/shop/$category` category pages (same grid, tab preselected).
- `/product/$slug` gallery with thumbnails, size/variant picker for apparel, quantity counter, accordion (Description, Size guide, Shipping).
- `/checkout` mock form (contact, shipping, payment placeholder) + order summary; places an order and shows confirmation.
- `/auth` login / signup.

## Shared UI
- Sticky nav: logo, category links (collapsing to a mobile menu), search toggle, account, cart icon with count.
- Slide-over cart drawer: items, qty change, remove, subtotal in RM, checkout button.
- Product card: image, title, sale/regular price, sale badge, quick Add to Cart (opens size choice for apparel).

## Data (Lovable Cloud)
- Tables: `categories`, `products` (price, sale price, images, sizes, description), `cart_items` (per signed-in user), `orders` + `order_items`.
- Seeded with ~16 mock products: Mae Hong Son Loop 1864 Curves sticker, Route 1 curve badge set, riding jacket, windbreaker, hoodie, kopi tees, insulated tumblers, enamel mug, patches, keychain, cap.
- Cart: saved in the browser for guests, synced to `cart_items` when signed in. Orders saved to `orders` on checkout (guest or signed in).
- Email/password sign-in enabled.
- Generated product images (~10) for a cohesive catalog.

## Technical details
- Enable Lovable Cloud; migration creates tables with GRANTs + RLS: public read on categories/products; cart_items owned by `auth.uid()`; orders insert for anon/auth, read own.
- Data via TanStack Query (`ensureQueryData` in loaders + `useSuspenseQuery`), cart in a React context backed by localStorage.
- Prices formatted as RM; head() metadata per route; sonner toasts on add-to-cart.
