import { describe, it, expect } from "vitest";
import { buildReceiptSnapshot, pricedPosLines, receiptUnitThb, resolvePosPromo, snapshotUnitThb } from "@/lib/pos-pricing";

const jersey = { name: "Jersey", category_slug: "jerseys", sale_price: 99, receipt_thb_rm_sale: 750 };
const base = { rmBase: 100, paidDiscount: 10, thbBase: 1000, hasPromo: true, current: null };

describe("THB on receipt (RM sale)", () => {
  it("filled: RM line at sale price uses the box", () => expect(receiptUnitThb(jersey, 99, "myr")).toBe(750));
  it("empty: keeps catalog THB", () => expect(receiptUnitThb({ ...jersey, receipt_thb_rm_sale: null }, 99, "myr")).toBeNull());
  it("normal RM price ignores it", () => expect(receiptUnitThb(jersey, 120, "myr")).toBeNull());
  it("THB orders ignore it", () => expect(receiptUnitThb(jersey, 99, "thb")).toBeNull());
  it("paper bundle stickers ignore it", () => expect(receiptUnitThb({ ...jersey, name: "STICKER (8x8cm) A", category_slug: "stickers" }, 99, "myr")).toBeNull());
  it("snapshot unit drives the receipt and totals reconcile", () => {
    const s = buildReceiptSnapshot("myr", [{ productId: "p1", variant: "M", receiptThb: 750 }], 100);
    const unit = snapshotUnitThb(s, "p1", "M");
    const r = pricedPosLines([{ variantId: "v", name: "Jersey", size: "M", category_slug: "jerseys", quantity: 2, priceThb: unit }], 100);
    expect(r.total).toBe(1400);
    expect(r.lines.reduce((a, l) => a + l.price * l.quantity, 0)).toBe(1400);
  });
  it("THB orders save no snapshot", () => expect(buildReceiptSnapshot("thb", [{ productId: "p", variant: "", receiptThb: 1 }], 5)).toBeNull());
});

describe("THB off on receipt", () => {
  const fixed = { discount_type: "fixed_amount" as const, discount_value: 10, discount_myr: 10, discount_thb: 200, };
  const pct = { discount_type: "percentage" as const, discount_value: 10, discount_myr: null, discount_thb: null };
  it("fixed filled: uses box", () => expect(resolvePosPromo({ ...base, currency: "myr", snapshot: fixed, receiptPromoThb: 80 }).discount).toBe(80));
  it("fixed empty: uses THB off", () => expect(resolvePosPromo({ ...base, currency: "myr", snapshot: fixed, receiptPromoThb: null }).discount).toBe(200));
  it("percentage filled: fixed THB", () => expect(resolvePosPromo({ ...base, currency: "myr", snapshot: pct, receiptPromoThb: 150 }).discount).toBe(150));
  it("percentage filled: capped at merchandise", () => expect(resolvePosPromo({ ...base, currency: "myr", snapshot: pct, receiptPromoThb: 5000 }).discount).toBe(1000));
  it("percentage empty: percent of THB total", () => expect(resolvePosPromo({ ...base, currency: "myr", snapshot: pct, receiptPromoThb: null }).discount).toBe(100));
  it("THB orders ignore the box", () => expect(resolvePosPromo({ ...base, currency: "thb", snapshot: pct, receiptPromoThb: 500 }).discount).toBe(10));
  it("no saved value and no snapshot: staff confirmation", () => expect(resolvePosPromo({ ...base, currency: "myr", snapshot: null, receiptPromoThb: null }).needsConfirmation).toBe(true));
});

describe("THB on receipt is never reduced by promo", () => {
  it("locked line keeps exact amount; promo goes to other lines", () => {
    const r = pricedPosLines([
      { variantId: "w", name: "Wristband", size: "", category_slug: "other", quantity: 2, priceThb: 20, locked: true },
      { variantId: "m", name: "Magnet", size: "", category_slug: "magnets", quantity: 1, priceThb: 100 },
    ], 15);
    expect(r.lines.find((l) => l.variant_id === "w")?.price).toBe(20);
    expect(r.total).toBe(125);
    expect(r.promoBase).toBe(100);
  });
  it("only locked lines: receipt total stays 40", () => {
    const r = pricedPosLines([{ variantId: "w", name: "Wristband", size: "", category_slug: "other", quantity: 2, priceThb: 20, locked: true }], 0);
    expect(r.total).toBe(40);
    expect(r.promoBase).toBe(0);
  });
});
