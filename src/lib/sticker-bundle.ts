export type BundleLine = { name: string; category_slug: string; quantity: number };

/** Any mixed 8×8cm paper designs qualify; chromium stickers never do. */
export function stickerBundle(lines: BundleLine[], country: string) {
  const quantity = country === "Thailand" ? lines.reduce((sum, line) =>
    sum + (line.category_slug === "stickers" && line.name.startsWith("STICKER (8x8cm)") ? line.quantity : 0), 0) : 0;
  const groups = Math.floor(quantity / 3);
  const remainder = quantity % 3;
  return { quantity, groups, remainder, total: groups * 140 + remainder * 49, discount: groups * 7 };
}