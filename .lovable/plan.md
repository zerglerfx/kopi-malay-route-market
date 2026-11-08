# Payments, Telegram alerts and receipts

## What you get
1. **Local payment options at Stripe checkout**
   - Malaysia (RM): FPX online banking + cards.
   - Thailand (THB): PromptPay QR + cards.
   - Totals stay as they are now: subtotal, quantity-block shipping and the RM 10 Sabah/Sarawak charge, all re-checked on the server.
2. **Telegram alert for every paid order**, sent to your chat with: order number, customer name/email/phone, address (country, state), payment method (FPX / PromptPay / Card) and currency, items with sizes and quantities, subtotal / shipping / total, and a "Payment verified" status.
3. **Better receipt page** after payment: items, shipping breakdown (incl. Sabah/Sarawak charge), payment method, total, and what happens next (shipping from Tak, tracking sent by message/email). Mobile-friendly and printable.
4. **Order records + admin page**: every order saves payment method, Stripe payment reference, status and a payment event log. A new admin-only Orders page lists orders and lets you mark them Paid → Packed → Shipped (with tracking number) → Delivered.

## What you need to do
- In your Stripe account, turn on **FPX** and **PromptPay** under Payment methods (they only work once Stripe approves them on your account). Until then, checkout falls back to cards.
- Connect your Telegram bot (a connect card will appear) and send it one message so I can find your chat.
- Tell me which login email should be the admin.

## Technical details
- Keep the existing signed webhook route `/api/public/stripe-webhook` instead of a Supabase Edge Function (this project's backend runs on server routes; edge functions aren't used here). Telegram send happens there, via the Telegram connector gateway, only after signature check and `payment_status === "paid"` (FPX/PromptPay also handle `checkout.session.async_payment_succeeded` / `_failed`).
- Checkout session: `payment_method_types` = `["card","fpx"]` for MYR, `["card","promptpay"]` for THB; read actual method from the PaymentIntent's charge at webhook time.
- Idempotency: `orders.notified_at` column; alert sent only if null (webhook + success-page fallback can't double-send).
- Migration (additive): `orders` add `payment_method_type text`, `notified_at timestamptz`, `fulfillment_status text default 'unfulfilled'`, `tracking_number text`; new `payment_events` (order_id, stripe_event_id unique, type, payload jsonb, created_at); `app_role` enum + `user_roles` + `has_role()`; admin SELECT/UPDATE policies on orders/order_items/payment_events.
- Admin route `/_authenticated/admin/orders` with server functions guarded by `requireSupabaseAuth` + `has_role(admin)`.
- Tests: payment-method selection per currency, Telegram message formatting (items, sizes, totals, surcharge), alert sent once.
