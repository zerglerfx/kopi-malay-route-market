export type BundleLine = { name: string; category_slug: string; quantity: number };

/** Per-country 8×8cm paper sticker bundle rates: every 3 stickers cost `bundle`, leftovers cost `unit`. */
export const STICKER_BUNDLE_RATES = {
  Thailand: { unit: 49, bundle: 140 },
  Malaysia: { unit: 6.5, bundle: 18 },
} as const;

const round = (n: number) => Math.round(n * 100) / 100;

/** Any mixed 8×8cm paper designs qualify; chromium stickers never do. */
export function stickerBundle(lines: BundleLine[], country: string) {
  const rate = STICKER_BUNDLE_RATES[country as keyof typeof STICKER_BUNDLE_RATES];
  const quantity = rate ? lines.reduce((sum, line) =>
    sum + (line.category_slug === "stickers" && line.name.startsWith("STICKER (8x8cm)") ? line.quantity : 0), 0) : 0;
  const groups = Math.floor(quantity / 3);
  const remainder = quantity % 3;
  const unit = rate?.unit ?? 0;
  const bundle = rate?.bundle ?? 0;
  return { quantity, groups, remainder, total: round(groups * bundle + remainder * unit), discount: round(groups * (unit * 3 - bundle)), unit, bundle };
}
