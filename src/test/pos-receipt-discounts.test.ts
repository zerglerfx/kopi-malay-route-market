import { describe, expect, it } from "vitest";
import { posReceiptBreakdown, satang } from "@/lib/pos-pricing";

const shirt = { variantId: "s", name: "Shirt", size: "M", category_slug: "jerseys", quantity: 2, priceThb: 400, regularThb: 500 };
describe("Loyverse receipt discount lines", () => {
  it("prices lines at regular price and shows Sale and Promo separately", () => {
    const r = posReceiptBreakdown([shirt], 80, "earlybird");
    expect(r.lines[0]?.price).toBe(500);
    expect(r.subtotal).toBe(1000);
    expect(r.discounts.map((d) => [d.name, d.amount])).toEqual([["WEB SALE", 200], ["PROMO EARLYBIRD", 80]]);
    expect(r.total).toBe(720);
  });
  it("adds no discount lines when nothing applies", () => {
    const r = posReceiptBreakdown([{ ...shirt, priceThb: 500 }], 0, null);
    expect(r.discounts).toEqual([]);
    expect(r.total).toBe(1000);
  });
  it("keeps locked THB-on-receipt price with no sale line", () => {
    const r = posReceiptBreakdown([{ ...shirt, priceThb: 20, regularThb: 29, locked: true }], 0, null);
    expect(r.lines[0]?.price).toBe(20);
    expect(r.discounts).toEqual([]);
  });
  it("shows the sticker bundle saving", () => {
    const st = { variantId: "x", name: "STICKER (8x8cm) A", size: "", category_slug: "stickers", quantity: 3, priceThb: 49, regularThb: 49 };
    const r = posReceiptBreakdown([st], 0, null);
    expect(r.discounts.map((d) => d.name)).toEqual(["WEB BUNDLE"]);
    expect(satang(r.total)).toBe(14000);
  });
});
