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
- Stripe payment confirmation happens in `/api/public/stripe-webhook` (signature-verified), with the success page re-checking the Stripe session as a fallback.
- Product images use keys mapped in `src/lib/shop.ts` to bundled assets or CDN pointer imports; full URLs are also accepted, so uploaded media remains out of the repository.
- Destination pricing and shipping share browser-safe helpers: checkout rehydrates cart products from the catalog and the server independently computes the same totals; orders persist currency to keep historical receipts accurate.
- Shipping helpers return null when a destination's rate cannot be determined; both checkout surfaces block payment rather than assume weights or unconfigured rates. Unit weights are read from product records, never from client checkout input.
- Retire replaced catalog placeholders with `is_active=false`, excluding them from reads and checkout while retaining historical order references.
