# Major Update: Admin Dashboard, Towing & Rescue, Wishlist, New Theme

This is a large update, so it ships in phases. Each phase works on its own and is checked before the next one starts.

## Phase 1 — Look & navigation
- **Monochrome theme:** swap the cream and warm colours for black, white and dark grey across the whole site. Blue, red and yellow stay only as small accents (sale badges, the road stripe), unless you want them gone too.
- **Header:** make it taller, take the "KOPI MALAY x ROUTE 1" wording out next to the logos, and keep both logos.
- **Navigation:** add two dropdowns:
  - **Shop**: Shop All, Jerseys & T-shirts, Stickers, Tumblers, Fridge Magnets, Patches, Lanyard, Other Merch.
  - **Services**: Towing & Rescue.
  - On phones, the slide-out menu groups the links the same way.
- **Marquee:** a black scrolling strip under the header on every page that reads "Register To Be A Member Today To Receive Special Offer!". Tapping it opens the sign-up page. The scrolling stops for visitors whose device is set to reduce motion.
- **New Arrival carousel:** replaces the static home banner. It shows products marked "New Arrival" with left and right arrows, swipe on phones and dots. Each slide links to its product.

## Phase 2 — Accounts, guest checkout & wishlist
- **Login and sign-up** with Google or with email and password. Email/password already exists, so this phase adds the Google button.
- **Guest checkout:** you can already buy without an account. This stays as it is, and the checkout page gets a short note saying so.
- **Wishlist:** a heart button on product cards and product pages, plus a new Wishlist page.
  - Guests' wishlists are kept on their device.
  - Signed-in members' wishlists are saved to their account. Anything saved as a guest is merged in when they log in.

## Phase 3 — Towing & Rescue
- **New page `/towing`** with these fields, all required: name, plate number, motorcycle model, phone, breakdown location / distance, and towing destination address.
- **Map pin:** a Google Map where the rider taps or drags a pin to set the pick-up point. A "Use my location" button fills it in automatically.
- **After sending:** the request is saved, a Telegram alert is sent with the details and a Google Maps link to the pin, and the rider sees a reference number.
- **Google Maps setup:** this needs the Google Maps connection to be set up. A connect card will appear for you to approve.

## Phase 4 — Admin dashboard (`/admin`, admins only)
Access is checked by the server, not just hidden in the page. Your account is made the first admin.
- **Orders**
  - Table columns: NO., Nama, Alamat, No. Telefon, Payment Ref / Receipt (view the receipt, mark Verified or Rejected), Items breakdown, Order ref / tracking number (editable) with a QR code.
  - Search by phone number.
  - Export to CSV, which opens in Excel.
- **Promo codes:** create, edit, turn on or off, and see how many times each was used.
- **Products:** edit price (RM and THB), category, weight, description, photos and sizes. Mark items as New Arrival, add new products, and hide old ones.
- **Towing requests:** a list with a map link for each, and status updates (New, Dispatched, Completed, Cancelled).
- **Users:** a list of registered members (email, joined date, order count). Admins can give or remove admin access.
- **Loyverse sync**
  - A product's stock can be linked to a Loyverse item and size.
  - A "Sync stock now" button pulls the latest counts.
  - Stock from Loyverse is shown read-only, because Loyverse stays the master record. Edit stock counts in Loyverse.
  - Products are not created automatically in Loyverse. You add new items in Loyverse first, then link them here. This avoids duplicates in your shop register.

## Things to confirm
1. **First admin:** which login email should get admin access?
2. **Accent colours:** remove all colour, or keep small red and yellow accents?
3. **Tracking number:** "QR Code / Tracking" is assumed to mean an order QR code plus a courier tracking number field.

## Technical details
- **New tables, all with access rules:**
  - `user_roles` (with an `app_role` enum and a `has_role` function)
  - `wishlist_items` (owner-only)
  - `towing_requests` (anyone can submit; only admins can read)
  - new columns: `products.is_new_arrival`, `orders.payment_status` and `orders.tracking_number`
- **Admin server code:** each admin server function uses `requireSupabaseAuth` and also checks the admin role. Admin-only reads and writes go through the service-role client inside the handler, only after the role check passes.
- **Admin routes:** live under `_authenticated/admin.*`. Admin is a nested pathless layout gate.
- **Google sign-in:** uses `configure_social_auth` with google, and the button follows Google's branding rules.
- **Maps:** browser key via the Google Maps connector, using the plain JS loader and the `google.maps.Marker` pin.
- **CSV:** built on the server from the filtered orders, as UTF-8 with a BOM so Excel opens it correctly.
- **Loyverse:** reuse `loyverse.server.ts` for the pull, and add a server function that lists Loyverse items to choose from when linking.
- **Tests:** the role check, CSV columns, wishlist merge and towing form validation.
