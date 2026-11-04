import tee from "@/assets/p-tee.jpg";
import jacket from "@/assets/p-jacket.jpg";
import hoodie from "@/assets/p-hoodie.jpg";
import sticker from "@/assets/p-sticker.jpg";
import tumbler from "@/assets/p-tumbler.jpg";
import cap from "@/assets/p-cap.jpg";

const IMAGES: Record<string, string> = {
  tee, "tee-back": tee, jacket, hoodie, sticker, tumbler, mug: tumbler, cap, patch: cap,
};

export function imageFor(key: string | undefined): string {
  if (!key) return tee;
  if (key.startsWith("http")) return key;
  return IMAGES[key] ?? tee;
}

export function formatRM(value: number): string {
  return `RM ${value.toFixed(2)}`;
}

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  sale_price: number | null;
  images: string[];
  variants: { sizes?: string[] };
  is_featured: boolean;
  stock_qty: number;
  category_slug: string;
  category_name: string;
};

export type Category = { id: string; name: string; slug: string };

export function effectivePrice(p: { price: number; sale_price: number | null }): number {
  return p.sale_price != null && p.sale_price < p.price ? p.sale_price : p.price;
}

export function isApparel(p: { variants: { sizes?: string[] } }): boolean {
  return (p.variants?.sizes?.length ?? 0) > 0;
}

export const MY_STATES = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Melaka", "Negeri Sembilan",
  "Pahang", "Penang", "Perak", "Perlis", "Putrajaya", "Sabah", "Sarawak", "Selangor", "Terengganu",
] as const;

const EAST = new Set(["Sabah", "Sarawak", "Labuan"]);

export function isEastMalaysia(state: string): boolean {
  return EAST.has(state);
}

export function shippingFee(state: string): number {
  if (!state) return 0;
  return isEastMalaysia(state) ? 15 : 8;
}

export function deliveryEstimate(state: string): string {
  return isEastMalaysia(state) ? "5-8 business days" : "3-5 business days";
}

export type CartLine = {
  productId: string;
  variant: string;
  quantity: number;
};

/** Merge guest lines into account lines: same product+variant adds quantity, nothing is dropped. */
export function mergeCartLines<T extends CartLine>(account: T[], guest: T[]): T[] {
  const out = account.map((l) => ({ ...l }));
  for (const g of guest) {
    const hit = out.find((l) => l.productId === g.productId && l.variant === g.variant);
    if (hit) hit.quantity += g.quantity;
    else out.push({ ...g });
  }
  return out;
}
