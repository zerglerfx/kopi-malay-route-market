# Local payment methods and receipt

## What you get
1. **Local payment options at Stripe checkout**
   - Malaysia (RM): FPX online banking + cards.
   - Thailand (THB): PromptPay QR + cards.
   - Totals stay as they are now: subtotal, quantity-block shipping and the RM 10 Sabah/Sarawak charge, all re-checked on the server.
2. **Better receipt page** after payment: items with sizes, subtotal, shipping (showing the Sabah/Sarawak charge when it applies), total, payment method (FPX / PromptPay / Card), and what happens next (shipped from Tak, tracking sent once dispatched). Works well on phones and can be printed.
3. **Saved payment details**: each order records the payment method used, the Stripe payment reference and a log of payment events, so orders can be reviewed later.

## What you need to do
- In your Stripe account, turn on **FPX** and **PromptPay** under Payment methods. Stripe has to approve them for your account. Until it does, checkout uses cards only.

## Technical details
- Checkout session: `payment_method_types` = `["card","fpx"]` for MYR and `["card","promptpay"]` for THB. If Stripe rejects a method the account hasn't enabled, retry once with cards only.
- Webhook (`/api/public/stripe-webhook`, existing signature check): handle `checkout.session.completed` (mark paid only when `payment_status === "paid"`), plus `checkout.session.async_payment_succeeded` / `async_payment_failed` for delayed FPX/PromptPay results. Read the actual method from the PaymentIntent's latest charge.
- Success page fallback reads the same fields; it shows a "payment processing" state while an async payment is still pending.
- Additive migration: `orders.payment_method_type text`; new `payment_events` table (order_id, stripe_event_id unique, type, created_at), with service-role access only.
- Tests: the payment methods offered for each currency, and the fallback to cards only.
