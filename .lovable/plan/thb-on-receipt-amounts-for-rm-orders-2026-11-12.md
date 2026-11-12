# THB-on-receipt amounts for RM orders

These values only change the baht amounts on the POS receipt of Malaysian (RM) orders. Customers' prices, totals, shipping, promo checks and stock logic stay unchanged.

## 1. Product dialog (Products & Stock tab)
- New optional box under "Sale price RM": **THB on receipt (RM sale)**, with the hint "Used only on the POS receipt for RM orders. Does not change what customers see or pay."
- Hidden for 8x8cm paper bundle stickers, which keep today's THB bundle behaviour. (Chromium stickers still show the box.)
- Used only when the RM order line was bought at the product's RM sale price. Normal-price RM lines, or an empty box, keep today's behaviour (catalog THB price).

## 2. Promo Codes tab
- Fixed-amount codes: new box under "RM off": **THB off on receipt (RM orders)**. "THB off" is unchanged.
- Percentage codes: same box under "Percent off": a fixed THB amount per order, capped at the order's THB merchandise total. If empty, the percent is applied to the THB merchandise total as now.
- Same hint under each box.

## 3. Validation
- Numbers only, zero or more, up to two decimals, on both the page and the server. Empty means "not set".

## 4. Saved with the order (additive)
- At order placement, RM orders save the receipt amounts actually used: per item, the THB receipt unit price (when it applied), and the promo's THB receipt discount (when set). Editing a product or promo later never changes that order's receipt.
- Orders already placed, and THB orders, save nothing new and keep today's behaviour.

## 5. Receipt amount logic (at Verify)
- Lines: saved receipt unit price, otherwise current behaviour.
- Discount: saved receipt discount (capped at the THB merchandise total), otherwise current behaviour.
- Receipt total = sum of lines minus discount; discount never exceeds the THB merchandise total.
- Staff THB discount confirmation is shown only when neither a saved receipt value nor the existing promo snapshot can give the amount.

## 6. Tests
- Product box filled / empty (including a normal-price RM line ignoring it).
- Fixed promo box filled / empty.
- Percentage promo box filled (including cap) / empty.
- THB order ignores all three; receipt total reconciles.

## Technical details
- Migration: nullable `products.receipt_thb_rm_sale numeric(10,2) CHECK >= 0`, `promo_codes.receipt_discount_thb numeric(10,2) CHECK >= 0`, `orders.pos_receipt_snapshot jsonb` (nullable, additive). Product/promo admin Zod schemas accept nullable 2-decimal values.
- `submitManualOrder` reads the new columns server-side and writes `pos_receipt_snapshot` = `{ items: [{product_id, variant, unit_thb}], promo_thb }` for RM orders only; totals and inserts are otherwise unchanged.
- `src/lib/pos-pricing.ts`: pure helpers `receiptUnitThb()` and extend `resolvePosPromo` with an optional `receiptPromoThb`, used by `order-pos.server.ts` before the existing fallbacks.

## Credit estimate
About 0.6–1.0 credits (database fields, two admin forms, order snapshot, receipt logic, tests).
