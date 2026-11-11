# POS receipt number on website orders

## Step 1 finding: no receipt is created
Verifying an order only changes stock counts. In `src/lib/admin.functions.ts` (line ~108) `updateOrder` calls `adjustStock` in `src/lib/loyverse.server.ts` (line 58), which posts new counts to Loyverse's inventory endpoint. Nothing calls Loyverse's receipts endpoint anywhere, so there is no receipt number to save. Per your instruction, nothing is built automatically.

## What automatic receipts would take (not built)
- On Verify: create a Loyverse sale receipt for the order's items, sizes and total, under a "Website" store/register and a payment type such as "MERCHANDISE (ONLINE QR)". Save the returned receipt number (e.g. 6-52329).
- On Reject / back to Pending after a receipt exists: create a refund receipt linked to the original, and save its number too.
- Stock: a receipt deducts stock by itself, and a refund adds it back. So the receipt must REPLACE the current stock change, never run alongside it. The existing "deducted once / restored once" lock would wrap the receipt call instead of the count change.
- Shared sticker pools: receipts deduct per Loyverse item, so pooled designs must be sent as their shared variant to avoid double deduction.
- Unknowns to confirm first: the Loyverse store ID, a payment type ID, whether your API key may create receipts, how sale prices/promo/shipping appear on the receipt (shipping as its own line?), and receipt time (orders verified at night land in that day's reports — no shift needed, API receipts aren't tied to a cashier shift).
- Orders verified before the change: no receipt exists. Leave them blank (staff can type one in), never back-create receipts, because that would deduct stock again.
- Rough size: ~3-5 credits, plus testing against your live Loyverse.

## Simpler alternative (proposed to build now)
A manual "POS receipt no." field:
- Staff ring up the sale in Loyverse as usual, then type the receipt number (e.g. 6-52329) on the order.
- Shown as a "POS receipt" column at the end of the admin orders table and in the order details, editable inline.
- Stock logic, shipping, pricing, promos and checkout untouched. Note: if staff ring the sale in Loyverse, that also deducts stock, so with this option they should not also Verify-deduct — we'd need to decide which one moves stock.
- About 0.5-1 credit.

## Question for you
Which do you want: the manual field now, or the automatic receipt flow (replacing the current stock change)? With the manual field, should ringing up in Loyverse become the only way stock moves for web orders?

## Technical details (manual option)
- Migration: add `pos_receipt_number text` to `orders`.
- `admin.functions.ts`: include it in the orders select; new admin-checked `setPosReceipt` server function (trimmed, max 30 chars).
- `admin.index.tsx`: last column + detail field with save.
