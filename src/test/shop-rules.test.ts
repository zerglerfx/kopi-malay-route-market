import { describe, expect, it } from "vitest";
import { APPAREL_SIZES, formatMoney, formatRM, mergeCartLines, shippingFee } from "@/lib/shop";

describe("shipping", () => {
  it("ships jerseys free to Thailand", () => {
    expect(shippingFee("Thailand", [{ category_slug: "jerseys-t-shirts", quantity: 4 }], "Tak")).toBe(0);
  });
  it("adds RM 10 once in Sabah across all categories", () => {
    for (const category_slug of ["jerseys-t-shirts", "tumblers", "stickers", "fridge-magnets", "patches", "lanyard", "other-merch"]) {
      expect(shippingFee("Malaysia", [{ category_slug, quantity: 1 }], "Sabah")).toBe(30);
    }
    expect(shippingFee("Malaysia", [{ category_slug: "jerseys-t-shirts", quantity: 3 }, { category_slug: "tumblers", quantity: 2 }, { category_slug: "stickers", quantity: 21 }], "Sabah")).toBe(110);
  });
  it("adds RM 10 once in Sarawak", () => {
    expect(shippingFee("Malaysia", [{ category_slug: "jerseys-t-shirts", quantity: 4 }], "Sarawak")).toBe(50);
  });
  it("keeps the base rate elsewhere including Labuan", () => {
    for (const state of ["Johor", "Selangor", "Labuan"]) expect(shippingFee("Malaysia", [{ category_slug: "jerseys-t-shirts", quantity: 2 }], state)).toBe(20);
  });
  it("ships accessories free to Thailand", () => {
    expect(shippingFee("Thailand", [{ category_slug: "stickers", quantity: 99 }, { category_slug: "fridge-magnets", quantity: 21 }, { category_slug: "patches", quantity: 3 }, { category_slug: "lanyard", quantity: 2 }, { category_slug: "other-merch", quantity: 1 }])).toBe(0);
  });
  it("charges a flat THB 60 for tumbler weight under 1kg, even mixed with accessories", () => {
    expect(shippingFee("Thailand", [{ category_slug: "tumblers", quantity: 3, weight_kg: 0.3 }, { category_slug: "stickers", quantity: 99 }])).toBe(60);
  });
  it("requires a quote for unknown tumbler weights or weights of 1kg and above", () => {
    expect(shippingFee("Thailand", [{ category_slug: "tumblers", quantity: 1 }])).toBeNull();
    expect(shippingFee("Thailand", [{ category_slug: "tumblers", quantity: 2, weight_kg: 0.5 }])).toBeNull();
    expect(shippingFee("Thailand", [{ category_slug: "tumblers", quantity: 3, weight_kg: 0.5 }])).toBeNull();
  });
  it("charges RM 20 for every two tumblers", () => {
    expect([1, 2, 3, 4, 5].map((quantity) => shippingFee("Malaysia", [{ category_slug: "tumblers", quantity }]))).toEqual([20, 20, 40, 40, 60]);
  });
  it("charges RM 20 for every two jerseys", () => {
    expect([1, 2, 3, 4, 5].map((quantity) => shippingFee("Malaysia", [{ category_slug: "jerseys-t-shirts", quantity }]))).toEqual([20, 20, 40, 40, 60]);
  });
  it("aggregates accessories in blocks of twenty", () => {
    expect([1, 20, 21, 40, 41].map((quantity) => shippingFee("Malaysia", [{ category_slug: "stickers", quantity }]))).toEqual([20, 20, 40, 40, 60]);
    expect(shippingFee("Malaysia", [{ category_slug: "patches", quantity: 9 }, { category_slug: "lanyard", quantity: 10 }, { category_slug: "other-merch", quantity: 1 }])).toBe(20);
    expect(shippingFee("Malaysia", [{ category_slug: "stickers", quantity: 10 }, { category_slug: "fridge-magnets", quantity: 11 }])).toBe(40);
  });
  it("adds distinct shipping groups", () => {
    expect(shippingFee("Malaysia", [{ category_slug: "tumblers", quantity: 3 }, { category_slug: "jerseys-t-shirts", quantity: 2 }, { category_slug: "stickers", quantity: 21 }])).toBe(100);
  });
});

it("offers XS through 5XL for apparel", () => expect(APPAREL_SIZES).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"]));
it("formats Thai prices without currency conversion", () => expect(formatMoney(259, "thb")).toBe("THB 259.00"));

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
