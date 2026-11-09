import { expect, it } from "vitest";
import { stickerBundle } from "@/lib/sticker-bundle";

it.each([[1, 49], [2, 98], [3, 140], [4, 189], [5, 238], [6, 280], [7, 329], [9, 420]])(
  "%i paper stickers cost THB %i with repeating three-unit bundles", (quantity, total) => {
    const result = stickerBundle([{ name: "STICKER (8x8cm) - LOGO", category_slug: "stickers", quantity }], "Thailand");
    expect(result.total).toBe(total);
    expect(quantity * 49 - result.discount).toBe(total);
  },
);
it("combines random designs but excludes chromium", () => {
  expect(stickerBundle([
    { name: "STICKER (8x8cm) - LOGO", category_slug: "stickers", quantity: 1 },
    { name: "STICKER (8x8cm) - LOOP", category_slug: "stickers", quantity: 2 },
    { name: "CHROMIUM STICKERS (5x5cm)", category_slug: "stickers", quantity: 3 },
  ], "Thailand")).toEqual({ quantity: 3, groups: 1, remainder: 0, total: 140, discount: 7 });
});
it("does not change Malaysian prices", () => {
  expect(stickerBundle([{ name: "STICKER (8x8cm) - LOGO", category_slug: "stickers", quantity: 6 }], "Malaysia").discount).toBe(0);
});