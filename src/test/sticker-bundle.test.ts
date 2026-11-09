import { expect, it } from "vitest";
import { stickerBundle } from "@/lib/sticker-bundle";

const one = (quantity: number, country: string) =>
  stickerBundle([{ name: "STICKER (8x8cm) - LOGO", category_slug: "stickers", quantity }], country);

it.each([[1, 49], [2, 98], [3, 140], [4, 189], [5, 238], [6, 280], [7, 329], [9, 420]])(
  "%i paper stickers cost THB %i with repeating three-unit bundles", (quantity, total) => {
    const result = one(quantity, "Thailand");
    expect(result.total).toBe(total);
    expect(quantity * 49 - result.discount).toBe(total);
  },
);
it.each([[1, 6.5], [2, 13], [3, 18], [4, 24.5], [5, 31], [6, 36]])(
  "%i paper stickers cost RM %d in Malaysia", (quantity, total) => {
    const result = one(quantity, "Malaysia");
    expect(result.total).toBe(total);
    expect(Math.round((quantity * 6.5 - result.discount) * 100) / 100).toBe(total);
  },
);
it("combines random designs but excludes chromium", () => {
  expect(stickerBundle([
    { name: "STICKER (8x8cm) - LOGO", category_slug: "stickers", quantity: 1 },
    { name: "STICKER (8x8cm) - LOOP", category_slug: "stickers", quantity: 2 },
    { name: "CHROMIUM STICKERS (5x5cm)", category_slug: "stickers", quantity: 3 },
  ], "Thailand")).toMatchObject({ quantity: 3, groups: 1, remainder: 0, total: 140, discount: 7 });
});
it("gives no bundle for other countries", () => {
  expect(one(6, "Singapore").discount).toBe(0);
});
