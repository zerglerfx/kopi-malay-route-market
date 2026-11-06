import { describe, expect, it } from "vitest";
import { formatRM, mergeCartLines, shippingFee } from "@/lib/shop";

describe("shipping", () => {
  it("charges RM 8 to West Malaysia", () => {
    expect(shippingFee("Selangor")).toBe(8);
    expect(shippingFee("Kuala Lumpur")).toBe(8);
  });
  it("charges RM 15 to Sabah and Sarawak", () => {
    expect(shippingFee("Sabah")).toBe(15);
    expect(shippingFee("Sarawak")).toBe(15);
  });
});

describe("currency", () => {
  it("formats as RM XX.XX", () => expect(formatRM(59)).toBe("RM 59.00"));
});

describe("cart merge on login", () => {
  it("adds guest quantity to matching account line and keeps others", () => {
    const account = [{ productId: "a", variant: "M", quantity: 1 }, { productId: "b", variant: "", quantity: 2 }];
    const guest = [{ productId: "a", variant: "M", quantity: 2 }, { productId: "c", variant: "", quantity: 1 }];
    const merged = mergeCartLines(account, guest);
    expect(merged).toEqual([
      { productId: "a", variant: "M", quantity: 3 },
      { productId: "b", variant: "", quantity: 2 },
      { productId: "c", variant: "", quantity: 1 },
    ]);
  });
  it("treats different sizes as separate lines", () => {
    const merged = mergeCartLines([{ productId: "a", variant: "M", quantity: 1 }], [{ productId: "a", variant: "L", quantity: 1 }]);
    expect(merged).toHaveLength(2);
  });
});
