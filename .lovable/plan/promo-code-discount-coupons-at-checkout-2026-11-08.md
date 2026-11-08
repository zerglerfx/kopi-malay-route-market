# Promo Code / Discount Coupons at Checkout

## What customers will see
- A "Promo Code / Discount" box with an **Apply** button in the checkout summary, above Subtotal/Shipping.
- Valid code: green badge ("ROUTE1BIKER applied"), a discount line (e.g. `- RM 10.00` or `- 15% (RM 4.50)`), and the Total and QR amount recalculated. A **Remove** button clears it.
- Invalid code: "Invalid or expired promo code" (or a specific reason, e.g. "Minimum order RM 50.00 not met").
- Changing destination (Malaysia/Thailand) or cart re-checks the code automatically.

## Rules
- Discount applies to the **product subtotal only**, not shipping, and never goes below zero.
- Fixed-amount codes have separate MYR and THB values so they work for both currencies (a code with no value for a currency is invalid for that destination). Minimum order amount works the same way (MYR and THB thresholds).
- A code is valid only if active, not expired, under its use limit, and the subtotal meets the minimum.
- Use count increases only when an order is actually saved; checked again at that moment so a code can't be over-used.
- The server always re-checks the code and recomputes the discount — the browser's number is never trusted.

## Order + Telegram
- Each order stores the promo code and discount amount; the order success page shows the discount line.
- Telegram alert adds: `🎟️ Promo Code Applied: ROUTE1BIKER (-RM 10.00)` and the subtotal/shipping/discount/total line.

## Managing codes
- No admin screen in this step. Codes are added/edited by asking in chat. I'll seed two examples (ROUTE1BIKER: RM 10 / THB 80 off; EARLYBIRD: 15% off) — tell me the real codes/values you want.

## Technical details
- Migration: `promo_codes` table (code unique, case-insensitive via upper(); discount_type enum `percentage|fixed_amount`; discount_value (percent) / discount_myr / discount_thb; min_order_myr / min_order_thb; max_uses nullable, current_uses default 0; is_active; expires_at nullable). Grants to service_role only, RLS on, no public policies (codes not listable). Add nullable `orders.promo_code`, `orders.discount_amount numeric default 0`.
- SECURITY DEFINER function `redeem_promo_code(code)` that atomically increments `current_uses` with the limit check.
- Shared browser-safe helper `computePromoDiscount(promo, subtotal, currency)` in `src/lib/promo.ts` + unit tests (percentage, fixed, cap at subtotal, min order, expiry, max uses).
- New server fn `validatePromoCode` (code, country, cart lines → re-priced subtotal) returning discount or error reason.
- `submitManualOrder`: accept optional promo code, re-validate, redeem, compute total = subtotal − discount + shipping, store fields, extend Telegram text. Failed redemption rejects with a clear message.
- `getOrderByReference` + `/order-success` show discount.
