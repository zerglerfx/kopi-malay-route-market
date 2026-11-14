# Part 2 — Step 1 only: Owner role, PIN, email code, alerts

Refund and Undo Verify are built in Step 2, after you test Step 1. Your 9 changes are recorded below for Step 2 as well.

## Decision needed before building: how the email code is sent

Checked: this project has **no email sending domain set up**. Sign-in emails use a default sender that only sends sign-in-type emails, so it cannot send a custom "your PIN code" email.

Two honest options:

1. **Set up your own email domain (recommended)** — e.g. `notify.kopimalay.shop`. You add a few DNS records once. Then we send a branded "Owner PIN code" email from the store, we generate the 6-digit code ourselves, store only its peppered hash, and enforce exactly: 10-minute expiry, single use, 3 wrong tries, 5 requests per hour.
2. **Reuse the sign-in "confirm it's you" code** — no domain needed, but the email looks like a generic account email, and the sending limit is the sign-in system's (shared with sign-ups and password resets), so I can't guarantee "5 per hour" — it may be lower.

I will not build until you pick one.

## Security finding (change 7)

- `kopimalay22@gmail.com`: already safe — granted only after a confirmed account with a verified Google identity.
- `zerglerfx@gmail.com`: **not safe today** — admin is granted the moment an account with that email is created, before confirmation. Fix: move it to the same rule (confirmed email + verified Google identity), applied at sign-in. Owner role uses the same rule for both emails.
- I could not read the hosted "require email confirmation" setting directly; the fix above makes owner/admin safe regardless of that setting.

## Step 1 build

- **Owner role** added alongside admin; granted to both emails by the safe rule above. Regular admins cannot set PINs, refund, or undo.
- **PIN**: exactly 6 digits. Hashed with PBKDF2 + per-PIN salt + a secret pepper stored in project secrets (not the database). Same pepper on email-code hashes.
- **Lockout**: failed attempts counted in one atomic database update; 5 fails = 15-minute lock + Telegram security alert. Wrong PIN changes nothing else.
- **Tables** for PINs and codes: RLS on, no client access at all, server-only.
- **Owner PIN window** in the admin header: shows "PIN set / not set" → Send code → enter code → new PIN → confirm.
- **Telegram**: alert after a PIN is set/reset, and on lockout. Codes are never sent to Telegram.
- **Tests**: admin-only account rejected; wrong PIN changes nothing; lockout at 5; code expiry/single use/5-per-hour limit; PIN must be exactly 6 digits.

## Step 2 (after your test) — recorded, not built yet

- Full refunds only: amount read-only from the order.
- Undo Verify lives in the order details popup next to Refund, needs a reason, logged in the timeline, Telegram alert.
- Order of operations: owner role + PIN → claim order with conditional status update → Loyverse. On Loyverse failure: restore status, no history row. Double-click can never create two refund receipts.
- Refunded orders excluded from sales totals (kept in list + CSV); "Refunded" shown on the order success page and the customer's account order history.
- Tests: second refund blocked, admin-only rejected, wrong PIN changes nothing, Loyverse failure restores status.

## Technical details

- Migration: `owner` enum value (separate migration before use), `owner_pins`, `owner_pin_codes` (RLS on, service_role grants only), atomic `register_pin_failure` / `consume_pin_code` SQL functions, updated sign-in grant trigger for both emails; remove insert-time grant in `grant_first_admin`.
- Secret: `OWNER_PIN_PEPPER` via generate_secret.
- `src/lib/owner-pin.server.ts` (hash/verify via Web Crypto, workerd-safe), new owner functions in `admin.functions.ts` re-checking `has_role(owner)` as caller.
- Option 1 also: email domain setup + one "owner-pin-code" app email template.
