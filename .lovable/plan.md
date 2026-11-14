# Owner / Staff / Customer labels in admin

Display and labels only. No database roles, permissions, access rules, totals, sales counter, CSV or stock logic change.

## 1. Users tab (still owner-only)
- One role badge per user: Owner, Staff (Admin) or Customer — highest role wins (Owner > Staff > Customer).
- Filter chips with counts: All, Owners, Staff, Customers. Search keeps working together with the chip.
- Sorted Owners, then Staff, then Customers; newest sign-up first within each group. Shows email and sign-up date.
- Checkbox renamed "Staff access (Admin)". Owners show a read-only "Owner" label (unchangeable, as now). Confirmed-email rule stays.
- Role is computed on the server inside the existing owner-only users list call; the page only displays it.

## 2. Orders tab and order details popup
- Small badge per order: Owner / Staff / Customer (placed from a signed-in account with that highest role) or Guest (no account).
- New "Placed by" filter: All, Guest, Customer, Staff, Owner. Works alongside existing filters.
- Badge is worked out on the server when orders are loaded (order's account id checked against roles), not in the browser.

## 3. Order timeline
- Each history entry shows an Owner or Staff badge next to the actor's email, looked up on the server from the actor's account id.

## Missing or role-less accounts
- In the timeline and Orders badges, a deleted account or a staff member whose role was removed shows no badge, and never causes an error. (A signed-in order from an account that still exists but has no role still shows Customer.)

## Answer to include in the summary
Today staff/owner-placed orders are counted in the sales totals — the counter only skips Refunded, Rejected and in-progress reversals. This stays unchanged.

## Technical details
- New browser-safe helper `src/lib/roles.ts`: `highestRole(roles)`, `orderPlacer(userId, rolesMap)`, `ROLE_ORDER`, `roleCounts(users)`.
- `listUsers` returns `role` and `created_at`, sorted server-side; `is_admin`/`is_owner` kept for the checkbox.
- `loadOrders` selects `user_id`, attaches `placed_by` via one `user_roles` query; `FilterSchema` gains optional `placed_by` used only by the list filter (CSV columns untouched).
- History query adds `changed_by`, attaches `actor_role`.
- Tests (`src/test/roles.test.ts`, plus admin-role test): badge per kind incl. multi-role; chip counts equal filtered list lengths; non-owner calling the users list is rejected; order badge for guest, customer and staff-placed orders; deleted or role-less accounts give no badge and no error.
