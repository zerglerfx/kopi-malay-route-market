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
- Product images are bundled assets referenced by key in `products.images` (mapped in `src/lib/shop.ts`); full URLs are also accepted.
