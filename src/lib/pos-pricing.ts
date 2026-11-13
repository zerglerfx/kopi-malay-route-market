import { stickerBundle } from "./sticker-bundle";

export type PromoSnapshot = { discount_type: "percentage" | "fixed_amount"; discount_value: number; discount_myr: number | null; discount_thb: number | null };
export const promoSnapshot = (p: PromoSnapshot): PromoSnapshot => ({ discount_type: p.discount_type, discount_value: Number(p.discount_value), discount_myr: p.discount_myr == null ? null : Number(p.discount_myr), discount_thb: p.discount_thb == null ? null : Number(p.discount_thb) });
export const satang = (n: number) => Math.round(n * 100);

export function promoAmount(p: PromoSnapshot, base: number, currency: "myr" | "thb"): number | null {
  const value = p.discount_type === "percentage" ? base * Math.min(100, Math.max(0, p.discount_value)) / 100 : currency === "myr" ? p.discount_myr : p.discount_thb;
  return value == null ? null : Math.min(satang(base), Math.max(0, satang(value))) / 100;
}

export function resolvePosPromo(input: { currency: string; rmBase: number; paidDiscount: number; thbBase: number; hasPromo: boolean; snapshot: PromoSnapshot | null; current: PromoSnapshot | null; confirmed?: number | undefined; receiptPromoThb?: number | null | undefined }) {
  if (input.confirmed !== undefined) {
    if (!Number.isFinite(input.confirmed) || input.confirmed < 0 || satang(input.confirmed) > satang(input.thbBase)) throw new Error("THB discount must be between zero and the merchandise total.");
    return { discount: satang(input.confirmed) / 100, needsConfirmation: false, confirmed: true };
  }
  if (!input.hasPromo) return { discount: 0, needsConfirmation: false, confirmed: false };
  if (input.currency.toLowerCase() === "myr" && input.receiptPromoThb != null) return { discount: Math.min(satang(Math.max(0, input.receiptPromoThb)), satang(input.thbBase)) / 100, needsConfirmation: false, confirmed: false };
  if (input.currency.toLowerCase() === "thb") return { discount: Math.min(satang(input.paidDiscount), satang(input.thbBase)) / 100, needsConfirmation: false, confirmed: false };
  const p = input.snapshot ?? input.current;
  const matches = p && (input.snapshot || satang(promoAmount(p, input.rmBase, "myr") ?? -1) === satang(input.paidDiscount));
  const amount = matches && p ? promoAmount(p, input.thbBase, "thb") : null;
  return { discount: amount ?? 0, needsConfirmation: amount == null, confirmed: false };
}

export type PosReceiptSnapshot = { items: { product_id: string; variant: string; unit_thb: number }[]; promo_thb: number | null };
export const isPaperBundleSticker = (p: { name: string; category_slug: string }) => p.category_slug === "stickers" && p.name.startsWith("STICKER (8x8cm)");
/** Receipt-only THB unit for an RM line bought at the RM sale price; null keeps catalog THB pricing. */
export function receiptUnitThb(p: { name: string; category_slug: string; sale_price: number | null; receipt_thb_rm_sale: number | null }, unitPaid: number, currency: string): number | null {
  if (currency.toLowerCase() !== "myr" || p.receipt_thb_rm_sale == null || p.sale_price == null || isPaperBundleSticker(p)) return null;
  return satang(unitPaid) === satang(p.sale_price) ? satang(p.receipt_thb_rm_sale) / 100 : null;
}
export function buildReceiptSnapshot(currency: string, lines: { productId: string; variant: string; receiptThb: number | null }[], promoThb: number | null): PosReceiptSnapshot | null {
  if (currency.toLowerCase() !== "myr") return null;
  const items = lines.flatMap((l) => l.receiptThb == null ? [] : [{ product_id: l.productId, variant: l.variant, unit_thb: l.receiptThb }]);
  const promo = promoThb == null ? null : satang(promoThb) / 100;
  return items.length || promo != null ? { items, promo_thb: promo } : null;
}
export const snapshotUnitThb = (s: PosReceiptSnapshot | null, productId: string | null, variant: string) => s?.items.find((x) => x.product_id === productId && x.variant === variant)?.unit_thb ?? null;

export type PosPricedItem = { variantId: string; name: string; size: string; category_slug: string; quantity: number; priceThb: number | null; locked?: boolean };

/** Integer satang allocation; split a quantity into adjacent unit prices when a penny cannot divide evenly. */
export function pricedPosLines(items: PosPricedItem[], promo: number) {
  if (!items.length) throw new Error("This order has no items.");
  const gross = items.map((it) => {
    if (it.priceThb == null || !Number.isFinite(it.priceThb) || it.priceThb < 0) throw new Error(`THB price missing for ${it.name}. Order not verified.`);
    if (!it.variantId) throw new Error(`Link ${it.name}${it.size ? ` (${it.size})` : ""} to Loyverse before verification.`);
    return satang(it.priceThb) * it.quantity;
  });
  const subtotal = gross.reduce((a, b) => a + b, 0);
  const bundle = satang(stickerBundle(items, "Thailand").discount);
  const allocate = (amount: number, weights: number[]) => {
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!sum) return weights.map(() => 0);
    const raw = weights.map((v) => amount * v / sum);
    const values = raw.map(Math.floor);
    let remainder = amount - values.reduce((a, b) => a + b, 0);
    const order = raw.map((v, i) => ({ i, fraction: v - Math.floor(v) })).sort((a, b) => b.fraction - a.fraction || a.i - b.i);
    for (const x of order) { if (remainder <= 0) break; values[x.i] = (values[x.i] ?? 0) + 1; remainder--; }
    return values;
  };
  const bundleParts = allocate(bundle, items.map((it, i) => it.category_slug === "stickers" && it.name.startsWith("STICKER (8x8cm)") ? gross[i] ?? 0 : 0));
  const bases = gross.map((v, i) => v - (bundleParts[i] ?? 0));
  const base = subtotal - bundle;
  const open = bases.map((v, i) => items[i]?.locked ? 0 : v);
  const openBase = open.reduce((a, b) => a + b, 0);
  if (satang(promo) < 0 || satang(promo) > openBase) throw new Error("THB promo discount exceeds merchandise total.");
  const promoParts = allocate(satang(promo), open);
  const lines = items.flatMap((it, i) => {
    const total = (bases[i] ?? 0) - (promoParts[i] ?? 0);
    const low = Math.floor(total / it.quantity), extra = total % it.quantity;
    const common = { variant_id: it.variantId, line_note: `${it.name}${it.size ? ` (${it.size})` : ""}`, line_discounts: [] as { id: string }[], line_modifiers: [] as { modifier_option_id: string }[] };
    return [
      ...(it.quantity - extra > 0 ? [{ ...common, quantity: it.quantity - extra, price: low / 100 }] : []),
      ...(extra > 0 ? [{ ...common, quantity: extra, price: (low + 1) / 100 }] : []),
    ];
  });
  return { lines, subtotal: subtotal / 100, bundle: bundle / 100, base: base / 100, promoBase: openBase / 100, total: (base - satang(promo)) / 100 };
}

export function posNote(o: { ref: string; cycle: number; currency: string; subtotal: number; sale?: number | undefined; bundle: number; promo: number; code: string | null; shipping: number; total: number; confirmedBy?: string | undefined; promoThb?: number | undefined }) {
  const c = o.currency.toLowerCase() === "myr" ? "RM" : "THB";
  return [`${o.ref} · sale ${o.cycle}`, `Paid ${c} ${o.total.toFixed(2)}`, ...(o.sale ? [`Subtotal (regular) ${c} ${(o.subtotal + o.sale).toFixed(2)}`, `Sale: -${c} ${o.sale.toFixed(2)}`] : [`Subtotal ${c} ${o.subtotal.toFixed(2)}`]), `Bundle: -${c} ${o.bundle.toFixed(2)}`, `Promo ${o.code ?? "none"}: -${c} ${o.promo.toFixed(2)}`, `Shipping ${c} ${o.shipping.toFixed(2)} (not on receipt)`, ...(o.confirmedBy ? [`THB promo ${Number(o.promoThb).toFixed(2)} confirmed by admin ${o.confirmedBy}`] : [])].join("\n");
}