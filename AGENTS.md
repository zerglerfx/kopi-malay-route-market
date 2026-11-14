<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Store data reads go through public server functions in `src/lib/shop.functions.ts`; checkout re-prices from the database server-side so client prices are never trusted.
- Keep the cart context singleton in a separate browser-safe module from its provider and hook; independently refreshed route consumers must retain the mounted provider's context identity.
- Payments are manual regional QR: checkout selects the country-specific asset and persists its payment method; `submitManualOrder` stores private receipts, saves `pending_verification`, and sends nonblocking Telegram alerts; `/order-success` requires reference + access token.
- Checkout details use a shared browser-safe Zod schema for inline feedback and server validation so required fields cannot be bypassed.
- Product images use keys mapped in `src/lib/shop.ts` to bundled assets or CDN pointer imports; full URLs are also accepted, so uploaded media remains out of the repository.
- Destination pricing and shipping share browser-safe helpers: checkout rehydrates cart products from the catalog and the server independently computes the same totals; orders persist currency to keep historical receipts accurate.
- Shipping helpers return null when a destination's rate cannot be determined; both checkout surfaces block payment rather than assume weights or unconfigured rates. Unit weights are read from product records, never from client checkout input.
- Accumulate catalog unit weights through the shared integer-gram parcel helper on browser and server; save weight and completeness at order placement so missing weights and historical totals remain explicit. Category-specific fixed unit weights are enforced on catalog writes by a database trigger.
- Pass the validated delivery state to the shared shipping helper on browser and server; region surcharges are applied once to the order, not per shipping group.
- Derive Thailand tumbler tiers and their base/excess breakdown through one browser-safe helper used by checkout and server alerts; calculate from catalog integer-gram weight so displayed and charged totals agree.
- Product details share a dialog-based image viewer using react-zoom-pan-pinch; apparel size charts use the uploaded asset rather than reconstructed measurements.
- Retire replaced catalog placeholders with `is_active=false`, excluding them from reads and checkout while retaining historical order references.
- Promo codes live in a service-role-only `promo_codes` table; `computePromoDiscount` in `src/lib/promo.ts` is shared by preview and `submitManualOrder`, which re-validates and atomically redeems via `redeem_promo_code` so the client discount is never trusted.
- Stock for Loyverse-linked items lives in `product_stock`; checkout only checks/snapshots inventory. Verify/reversal uses an atomic order claim and private durable `order_pos_operations` intents, with one sale/refund per cycle and reference reconciliation before retry; receipt-less historical restores remain count-based, and unknown stock never moves automatically.
- POS merchandise prices allocate bundle/promo savings in integer satang, splitting unit-price lines to preserve exact totals; shipping is note-only, included VAT is explicit, and checkout saves an additive promo snapshot for auditable THB pricing without changing charged totals.
- Ambiguous receipt writes are reconciliation-only until found, never blindly re-posted; refund write-offs persist absolute targets before sending and ambiguous inventory results require manual review to avoid overwriting intervening POS sales.
- Shared one-size inventory uses `shared_stock_links` pointing to a canonical `product_stock` variant; catalog reads resolve its single count and checkout aggregates mixed designs by variant before checking/deducting, preventing duplicate pool deductions.
- Paper-sticker bundle pricing uses one browser-safe helper in checkout, promo preview, and order placement; persist bundle savings separately from promo savings so historical receipts and alerts reconcile catalog line prices with the charged total.
- Admin access uses `user_roles` + `has_role`; every admin server function in `src/lib/admin.functions.ts` re-checks the role as the caller before using the service client, and the `/admin` route gate is only a UI convenience.
- Designated Google admin enrollment runs in an Auth sign-in lifecycle trigger and requires a confirmed account plus a matching verified Google identity; role grants are idempotent and never trust user-editable metadata.
- Wishlists live in localStorage for guests and `wishlist_items` for members, merged on sign-in via the shared `mergeWishlist` helper; the wishlist context lives in its own module like the cart.
- Towing requests are inserted only through the public `submitTowingRequest` server function (table has no public policies) and alert Telegram via `telegram.server.ts`; the pick-up map loads Maps JS lazily on the client only.
- Admin catalog edits never create Loyverse items; staff link products to existing Loyverse variants and stock stays read-only from Loyverse.
- Admin order status changes go only through `updateOrder` using the shared `src/lib/order-flow.ts` map; the service-only `transition_order_status` SQL function writes the status and its append-only `order_status_history` row in one transaction (Verify first claims via `claim_order_verify`), so the browser can never change status and history can't be edited.
- App emails use the server-only managed send helper and registered React Email templates; feature handlers fix the recipient and template, while `/lovable/*` bypasses app guards and authenticates itself, avoiding public arbitrary-send endpoints or local delivery queues.
- Owner PIN: owner role (granted at verified Google sign-in) gates PIN/refund/undo; PIN = PBKDF2 + salt + `OWNER_PIN_PEPPER` secret, email codes issued/checked and failures counted only by service-only SQL functions, so limits are atomic and the browser has no access.
