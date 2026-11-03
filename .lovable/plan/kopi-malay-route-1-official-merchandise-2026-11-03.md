# Kopi Malay - Route 1 Official Merchandise

## Look and feel
- Palette "Badge Blue/Red": ink #101418, cream #f4f1ea, road-sign blue #1d4ed8, badge red #d62828 (yellow accent for "curve" badges). Dark header/footer, cream content, thin card borders.
- Fonts: Space Grotesk (headings), DM Sans (body). Mobile-first; 2-col grid on phones, 3-4 on desktop.
- All prices shown as `RM XX.XX`.

## Pages
- `/` Home: hero, featured categories, featured products (`is_featured`), story strip.
- `/shop` Shop All with category tabs (All, Shirts, Sweaters & Jackets, Stickers, Tumblers, Other Merch), sort, search `?q=`.
- `/shop/$category` same grid with tab preselected.
- `/product/$slug` gallery, size/color picker only for apparel (required before Add to Cart / Buy Now), quantity, accordion (Description, Size guide, Shipping).
- `/checkout` form with Malaysian state dropdown; shipping RM 8.00 Peninsular / RM 15.00 Sabah, Sarawak, Labuan; order summary; Pay with Stripe. Returning via cancel shows a warning toast.
- `/checkout/success?session_id=...` order confirmation: order number, transaction ID, items, totals, estimated delivery (3-5 days West / 5-8 days East), printable receipt.
- `/auth` login / signup (email + password).

## Shared UI
- Sticky nav with category links (mobile menu), search toggle, account, cart count.
- Slide-over cart drawer: qty change, remove, subtotal, checkout.
- Product cards with sale/regular price, quick add (apparel opens size choice).
- Sonner toasts for cart updates, size warnings, payment outcomes.

## Data (Lovable Cloud)
- `categories` (id, name, slug unique)
- `products` (id, name, slug unique, description, price, sale_price, category_id, images text[], variants jsonb, is_featured, stock_qty)
- `cart_items` (id, user_id nullable, session_id, product_id, selected_variant, quantity, created_at)
- `orders` (id, order_number unique, user_id nullable, guest_email, shipping_address jsonb, subtotal, shipping_fee, total_amount, status default 'pending', payment_method default 'Stripe', stripe_session_id, stripe_payment_intent_id, created_at)
- `order_items` (id, order_id, product_id, product_name, selected_variant, unit_price, quantity)
- Public storage bucket `product-images`; generated product photos uploaded there.
- Seed ~16 products: Mae Hong Son Loop 1864 Curves sticker, Route 1 curve badge set, riding jacket, windbreaker, hoodie, kopi tees, tumblers, enamel mug, patches, keychain, cap.

## Cart and sign-in sync
- Guests: cart in browser storage keyed by a generated `session_id`.
- On login/signup: guest items are merged into the user's `cart_items` (same product + variant adds quantity; existing items kept), then browser cart cleared.

## Stripe checkout
- You'll be prompted to enter your Stripe secret key, plus the webhook signing secret after the webhook is registered in your Stripe dashboard.
- Checkout button calls a server action that re-prices items from the database, adds shipping, creates a pending order + order items, and opens a Stripe Checkout Session in MYR (prices in sen) with success/cancel URLs.
- Webhook endpoint listens for `checkout.session.completed`: verifies the signature, marks the order `paid`, saves the payment intent ID, and clears the signed-in user's cart rows. The browser cart is cleared on the success page.

## Technical details
- Stripe logic uses TanStack server functions and a server route `/api/public/stripe-webhook` instead of Supabase Edge Functions (this stack's convention); same behavior as the requested `create-checkout-session` / `stripe-webhook`. Webhook verifies via `stripe.webhooks.constructEventAsync` (Worker-safe).
- Secrets: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- RLS: public read on categories/products; cart_items owned by `auth.uid()` (guest cart lives in the browser); orders/order_items read own; order creation and payment updates done server-side only; success page loads order by Stripe session id through a server function.
- Data via TanStack Query (`ensureQueryData` + `useSuspenseQuery`); cart in a React context.
- Tests for shipping rates (RM 8 / RM 15) and cart merge rules.
