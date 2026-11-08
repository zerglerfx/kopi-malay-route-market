import { describe, expect, it } from "vitest";
import { computePromoDiscount, type Promo } from "@/lib/promo";

const base: Promo = { code: "X", discount_type: "fixed_amount", discount_value: 0, discount_myr: 10, discount_thb: 80, min_order_myr: null, min_order_thb: null, max_uses: null, current_uses: 0, is_active: true, expires_at: null };

describe("promo codes", () => {
  it("fixed MYR discount", () => expect(computePromoDiscount(base, 50, "myr")).toMatchObject({ ok: true, discount: 10 }));
  it("fixed THB discount", () => expect(computePromoDiscount(base, 500, "thb")).toMatchObject({ ok: true, discount: 80 }));
  it("percentage discount", () => expect(computePromoDiscount({ ...base, discount_type: "percentage", discount_value: 15 }, 30, "myr")).toMatchObject({ ok: true, discount: 4.5 }));
  it("caps at subtotal", () => expect(computePromoDiscount(base, 6.5, "myr")).toMatchObject({ ok: true, discount: 6.5 }));
  it("rejects inactive", () => expect(computePromoDiscount({ ...base, is_active: false }, 50, "myr").ok).toBe(false));
  it("rejects expired", () => expect(computePromoDiscount({ ...base, expires_at: "2020-01-01T00:00:00Z" }, 50, "myr").ok).toBe(false));
  it("rejects used up", () => expect(computePromoDiscount({ ...base, max_uses: 5, current_uses: 5 }, 50, "myr").ok).toBe(false));
  it("enforces minimum", () => expect(computePromoDiscount({ ...base, min_order_myr: 60 }, 50, "myr").ok).toBe(false));
  it("unknown code", () => expect(computePromoDiscount(null, 50, "myr").ok).toBe(false));
});
