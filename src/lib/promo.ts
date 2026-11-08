export type Promo = {
  code: string;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  discount_myr: number | null;
  discount_thb: number | null;
  min_order_myr: number | null;
  min_order_thb: number | null;
  max_uses: number | null;
  current_uses: number;
  is_active: boolean;
  expires_at: string | null;
};

export type PromoResult = { ok: true; discount: number; label: string } | { ok: false; error: string };

const round = (n: number) => Math.round(n * 100) / 100;

/** Discount on product subtotal only (never shipping), capped at the subtotal. */
export function computePromoDiscount(p: Promo | null, subtotal: number, currency: "myr" | "thb", now = new Date()): PromoResult {
  const invalid = { ok: false as const, error: "Invalid or expired promo code" };
  if (!p || !p.is_active) return invalid;
  if (p.expires_at && new Date(p.expires_at) <= now) return invalid;
  if (p.max_uses != null && p.current_uses >= p.max_uses) return { ok: false, error: "This promo code has reached its usage limit" };
  const min = currency === "thb" ? p.min_order_thb : p.min_order_myr;
  if (min != null && subtotal < min) {
    const amt = currency === "thb" ? `THB ${min.toFixed(2)}` : `RM ${min.toFixed(2)}`;
    return { ok: false, error: `Minimum order ${amt} not met` };
  }
  if (p.discount_type === "percentage") {
    const pct = Math.min(Math.max(p.discount_value, 0), 100);
    return { ok: true, discount: round(Math.min(subtotal, (subtotal * pct) / 100)), label: `${pct}%` };
  }
  const fixed = currency === "thb" ? p.discount_thb : p.discount_myr;
  if (fixed == null) return { ok: false, error: "This promo code isn't available for your destination" };
  return { ok: true, discount: round(Math.min(subtotal, Math.max(fixed, 0))), label: "" };
}
