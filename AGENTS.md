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
- Payments are manual DuitNow/TnG QR: `submitManualOrder` stores receipts in the private `payment-receipts` bucket, saves orders as `pending_verification`, and sends a Telegram alert (failure never blocks the order); `/order-success` reads orders by reference + access token.
- Product images use keys mapped in `src/lib/shop.ts` to bundled assets or CDN pointer imports; full URLs are also accepted, so uploaded media remains out of the repository.
- Destination pricing and shipping share browser-safe helpers: checkout rehydrates cart products from the catalog and the server independently computes the same totals; orders persist currency to keep historical receipts accurate.
- Shipping helpers return null when a destination's rate cannot be determined; both checkout surfaces block payment rather than assume weights or unconfigured rates. Unit weights are read from product records, never from client checkout input.
- Pass the validated delivery state to the shared shipping helper on browser and server; region surcharges are applied once to the order, not per shipping group.
- Product details share a dialog-based image viewer using react-zoom-pan-pinch; apparel size charts use the uploaded asset rather than reconstructed measurements.
- Retire replaced catalog placeholders with `is_active=false`, excluding them from reads and checkout while retaining historical order references.
- Promo codes live in a service-role-only `promo_codes` table; `computePromoDiscount` in `src/lib/promo.ts` is shared by preview and `submitManualOrder`, which re-validates and atomically redeems via `redeem_promo_code` so the client discount is never trusted.
