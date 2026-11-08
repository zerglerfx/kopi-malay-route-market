# Manual DuitNow / Touch 'n Go QR checkout with receipt upload and Telegram alerts

## What customers will see
1. **Checkout page**: the Stripe button is gone. After the address form there is a payment box showing your uploaded Touch 'n Go / DuitNow QR code, with the amount to pay and instructions:
   - Malaysia: scan with Touch 'n Go eWallet or any Malaysian banking app (DuitNow QR).
   - Thailand: scan with a Thai bank app (SCB, K-Bank, Krungthai) through cross-border PromptPay / DuitNow QR.
2. A short **Order Reference** (for example `KM-88219`) is shown in the payment box with a copy button, so customers put it in their transfer note.
3. A required **Upload payment proof** field (PNG, JPG or PDF, up to 5MB) with a file preview / name and an error for wrong type or size.
4. **Confirm Order & Submit Receipt** saves the order as "Pending Verification", then sends the customer to **/order-success**.
5. **/order-success**: reference number, a "Payment Proof Submitted - Pending Admin Verification" badge, full item list with shipping and total, and a support link to Telegram.

## What you get
- A Telegram message for each order: order ID, name, email, phone, full address with state and country, items with quantity and size, subtotal + shipping (Sabah/Sarawak RM 10 included) = total, and a link to view the receipt.
- Receipt links are private and expire after 7 days (they are not publicly browsable). Orders remain stored so a later admin page can show them.

## Things you need to provide during building
- Connect your Telegram bot (a connect card will appear; you create the bot with @BotFather if you don't have one).
- Send your bot one message (or add it to your group) so I can find the chat that should receive alerts.
- The Telegram username/link to show customers for support (placeholder until you give it).

## Technical details
- Remove `stripe` package, `createCheckoutSession`, `getOrderBySession`, `/api/public/stripe-webhook`, and `/checkout/success`; stop using Stripe secrets (left in place, unused). Historic Stripe columns on `orders` stay, unreferenced.
- QR image uploaded as a Lovable asset pointer.
- Private storage bucket `payment-receipts` (5MB limit). Uploads go through a server function (validated MIME/size/magic bytes) using the admin client; no public storage policies.
- Migration: add `orders.receipt_path text`, `orders.customer_phone`/reuse `shipping_address`; status value `pending_verification`. Order reference format `KM-` + 5 digits, unique, retried on collision; generated server-side when the order is submitted (shown on checkout as a preview reference generated at page load and reserved by the server, or returned and displayed if regenerated).
- `submitManualOrder` server function (multipart FormData): zod-validates fields, re-prices from DB, computes shipping with the shared helper (state passed), blocks Singapore/unpriced, stores receipt, inserts order + items, then sends Telegram via connector gateway (`sendMessage` with HTML, receipt signed URL; PDF/image also sent with `sendDocument`). Telegram failure is logged and does not fail the order.
- Uses a TanStack server function instead of a Supabase Edge Function (this project's convention); same behavior.
- `getOrderByReference` server function for `/order-success?ref=...` requiring the reference plus an unguessable token returned at submission, so others can't look up orders.
- Telegram chat ID stored as a secret `TELEGRAM_CHAT_ID`.
- Tests: reference format, file type/size validation, total = subtotal + shipping incl. Sabah surcharge. Update AGENTS.md and memory (payments now manual QR, not Stripe).
