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
- Product details share a dialog-based image viewer using react-zoom-pan-pinch; apparel size charts use the uploaded asset rather than reconstructed measurements.
- Retire replaced catalog placeholders with `is_active=false`, excluding them from reads and checkout while retaining historical order references.
- Promo codes live in a service-role-only `promo_codes` table; `computePromoDiscount` in `src/lib/promo.ts` is shared by preview and `submitManualOrder`, which re-validates and atomically redeems via `redeem_promo_code` so the client discount is never trusted.
