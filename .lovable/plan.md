# Deduct Loyverse stock when payment is verified, not at checkout

## What you will see
- Checkout still checks live stock and blocks items that are sold out, but it no longer takes anything out of Loyverse.
- Stock comes out of Loyverse only when an admin sets an order to **Verified**. Shipped and Completed are only allowed once an order has been Verified and the stock is out.
- If a verified order is set to **Rejected**, **Pending** or **Pending verification**, the same quantities go back into Loyverse, once. Rejecting an order whose stock never came out changes nothing.
- If Loyverse doesn't have enough stock when you click Verify, the order stays unverified. A warning lists each item with how many are needed and how many are available.
- Each order in the admin table gets a stock badge: "Stock deducted", "Not deducted", "Restored", or "Check manually" for old orders that may not have been deducted.

## Never twice
- Each order saves exactly which Loyverse items and quantities it took out. A restore puts back that saved list, even if a product's Loyverse link has changed since.
- The database blocks a second deduct or restore for the same order, so double clicks and back-and-forth status changes can't apply it twice.
- Re-verifying an order after a restore deducts again, once. That's correct, because the stock went back in.

## Orders placed before this change
- Every existing order is marked as already deducted, so verifying it won't deduct again.
- Older orders where checkout may have failed to deduct get marked "Check manually". Where the error logs are still available I'll use them to find these orders; I'll confirm how far back the logs go when I build this. If the logs don't go back far enough, all old orders still get marked deducted as you asked, and you check the flagged ones in Loyverse.

## Sync with Loyverse
- The Loyverse sync and webhook keep copying Loyverse's own counts onto the website. Loyverse stays the only source of truth, so the sync can't double count.
- Deducting and restoring always reread the live Loyverse count right before changing it, so a sale at the shop counter at the same moment isn't overwritten. A tiny timing window remains, because Loyverse has no "subtract" command, only "set to".

## Reconciling past rejected orders (nothing changes now)
1. After this update, filter the admin orders for Rejected orders created before today.
2. For each one, its items and sizes are listed in the Items column. In Loyverse Back Office, go to Inventory and do a stock adjustment (or receive items) to add those quantities back. Then set the order's stock badge to "Restored" using a small manual "Mark restored" action, which only changes the record and leaves Loyverse alone.
3. Skip any rejected order flagged "Check manually" that was never deducted, after confirming in Loyverse history.
If you'd like, I can later add a one-click "Restore stock" for these old orders, but only when you ask.

## Technical details
- Migration: add these columns to orders: `stock_status` text (`not_deducted` | `deducted` | `restored` | `unknown`, default `not_deducted`), `stock_deductions` jsonb (`[{variantId, quantity}]`), `stock_deducted_at`, `stock_restored_at`. Backfill existing rows to `deducted` (or `unknown` where flagged), and compute `stock_deductions` from their order_items using today's mappings.
- `submitManualOrder`: keep the stock check, drop `pushSale`, save the aggregated `sold` list into `stock_deductions` at placement, using the shared-pool `aggregateStockSales`.
- `updateOrder`: when moving into `verified`, an atomic `UPDATE ... WHERE stock_status IN ('not_deducted','restored') RETURNING` claims the order. Then check live levels: if short, revert the claim and return `{ shortfall: [...] }`. Otherwise run `pushSale`, and revert the claim if Loyverse fails. Restoring works the same way using `stock_status='deducted'` and a new `pushRestore` (stock_after = live + qty). Shipped/completed are rejected unless status is `deducted`.
- loyverse.server.ts: refactor into one shared `adjustStock(admin, deltas)` used for both directions. The webhook and pullStock logic stay the same.
- Admin UI: stock badge column, a shortfall toast/dialog, and a "Mark restored" (record-only) action for legacy rejected orders.
- Tests: no deduction at checkout; verify deducts once; a repeat verify is a no-op; reject after verify restores once; reject before verify changes nothing; a shortfall blocks the change; a shared-pool aggregate is restored correctly.
