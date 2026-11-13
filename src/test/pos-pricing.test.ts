import { describe, expect, it } from "vitest";
import { posNote, pricedPosLines, promoSnapshot, resolvePosPromo, satang } from "@/lib/pos-pricing";
import { filterOrders, ordersToCsv } from "@/lib/admin-csv";

const sticker = { variantId: "shared", name: "STICKER (8x8cm) - A", size: "", category_slug: "stickers", quantity: 3, priceThb: 49 };
const fixed = { discount_type: "fixed_amount" as const, discount_value: 0, discount_myr: 2, discount_thb: 10 };
const input = { currency: "myr", rmBase: 18, paidDiscount: 2, thbBase: 140, hasPromo: true, snapshot: null, current: fixed };
describe("POS THB pricing", () => {
  it("prices Malaysian stickers using THB 140 per three, not RM or shipping", () => {
    const r = pricedPosLines([sticker], 10);
    expect(r).toMatchObject({ subtotal: 147, bundle: 7, total: 130 });
    expect(r.lines.reduce((s, l) => s + satang(l.price) * l.quantity, 0)).toBe(13000);
    expect(r.lines.map((l) => l.variant_id)).toEqual(["shared", "shared"]);
  });
  it("allocates discounts to the satang with split quantities", () => {
    const r = pricedPosLines([{ ...sticker, quantity: 7 }], 0.01);
    expect(r.total).toBe(328.99);
    expect(r.lines.reduce((s, l) => s + satang(l.price) * l.quantity, 0)).toBe(32899);
    expect(r.lines.reduce((s, l) => s + l.quantity, 0)).toBe(7);
  });
  it("stops on missing THB prices", () => expect(() => pricedPosLines([{ ...sticker, priceThb: null }], 0)).toThrow("THB price missing"));
  it("stops on missing POS mapping", () => expect(() => pricedPosLines([{ ...sticker, variantId: "" }], 0)).toThrow("Link"));
  it("uses current promo only when RM discount reproduces", () => expect(resolvePosPromo(input)).toMatchObject({ discount: 10, needsConfirmation: false }));
  it("asks when current promo changed", () => expect(resolvePosPromo({ ...input, current: { ...fixed, discount_myr: 3 } }).needsConfirmation).toBe(true));
  it("asks rather than blocking a deleted promo", () => expect(resolvePosPromo({ ...input, current: null }).needsConfirmation).toBe(true));
  it("permits a confirmed zero discount", () => expect(resolvePosPromo({ ...input, current: null, confirmed: 0 })).toMatchObject({ discount: 0, confirmed: true, needsConfirmation: false }));
  it("caps entered discount at THB merchandise", () => expect(() => resolvePosPromo({ ...input, confirmed: 140.01 })).toThrow());
  it("saved promo overrides later edits", () => expect(resolvePosPromo({ ...input, snapshot: promoSnapshot(fixed), current: { ...fixed, discount_thb: 20 } }).discount).toBe(10));
  it("uses percentage in THB after bundle savings", () => expect(resolvePosPromo({ ...input, paidDiscount: 1.8, current: { ...fixed, discount_type: "percentage", discount_value: 10 } }).discount).toBe(14));
  it("notes only payment breakdown, reference/cycle and confirming admin", () => {
    const note = posNote({ ref: "KM-73679", cycle: 2, currency: "myr", subtotal: 19.5, bundle: 1.5, promo: 2, code: "KM", shipping: 20, total: 36, confirmedBy: "admin-id", promoThb: 10 });
    expect(note).toContain("KM-73679 · sale 2");
    expect(note).toContain("Shipping RM 20.00 (not on receipt)");
    expect(note).toContain("THB promo 10.00 confirmed by admin admin-id");
    expect(note).toContain("Promo KM: -RM 2.00");
  });
  it("shows regular subtotal minus sale on the receipt note", () => {
    const note = posNote({ ref: "KM-1", cycle: 1, currency: "thb", subtotal: 80, sale: 20, bundle: 0, promo: 0, code: null, shipping: 0, total: 80 });
    expect(note).toContain("Subtotal (regular) THB 100.00");
    expect(note).toContain("Sale: -THB 20.00");
  });
  it("search and export contain old sale and refund numbers", () => {
    const o = { order_number: "KM-73679", status: "verified", currency: "myr", created_at: "2026-11-12", total_amount: 36, payment_method: "qr", tracking_number: null, email: null, address: {}, items: [], pos_history: [{ kind: "sale", cycle: 1, receipt_number: "6-52329", created_at: "1" }, { kind: "refund", cycle: 1, receipt_number: "6-52330", created_at: "2" }, { kind: "sale", cycle: 2, receipt_number: "6-52331", created_at: "3" }] };
    expect(filterOrders([o], { q: "6-52329" })).toHaveLength(1);
    expect(filterOrders([o], { q: "6-52330" })).toHaveLength(1);
    expect(ordersToCsv([o])).toContain("sale 1: 6-52329; refund 1: 6-52330; sale 2: 6-52331");
  });
});