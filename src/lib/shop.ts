import tee from "@/assets/p-tee.jpg";
import jacket from "@/assets/p-jacket.jpg";
import hoodie from "@/assets/p-hoodie.jpg";
import sticker from "@/assets/p-sticker.jpg";
import tumbler from "@/assets/p-tumbler.jpg";
import cap from "@/assets/p-cap.jpg";
import tumbler16 from "@/assets/catalog/tumbler-16oz.jpg.asset.json";
import blackSticker from "@/assets/catalog/chromium-black-yellow.jpg.asset.json";
import redSticker from "@/assets/catalog/chromium-red-white.jpg.asset.json";
import logoSticker from "@/assets/catalog/kopi-malay-logo.jpg.asset.json";
import loopSticker from "@/assets/catalog/northern-full-loop.jpg.asset.json";
import pitSticker from "@/assets/catalog/pit-stop-south-asia.jpg.asset.json";
import signage from "@/assets/catalog/magnet-signage.jpg.asset.json";
import southMagnet from "@/assets/catalog/magnet-south-asia.png.asset.json";
import takMagnet from "@/assets/catalog/magnet-tak-city.png.asset.json";
import jersey from "@/assets/catalog/jersey-front-back.png.asset.json";
import jerseySleeves from "@/assets/catalog/jersey-sleeves.png.asset.json";
import stickerBanMaekonken from "@/assets/catalog/sticker-ban-maekonken-curve-33.jpg.asset.json";
import stickerBlackYellow from "@/assets/catalog/sticker-black-yellow-tak-route-1.jpg.asset.json";
import stickerRedWhite from "@/assets/catalog/sticker-red-white-tak-route-1.jpg.asset.json";
import stickerSignageA from "@/assets/catalog/sticker-signage-a.jpg.asset.json";
import stickerSignageB from "@/assets/catalog/sticker-signage-b.jpg.asset.json";
import stickerUmphang from "@/assets/catalog/sticker-umphang-1219-curves.jpg.asset.json";

const IMAGES: Record<string, string> = {
  tee, "tee-back": tee, jacket, hoodie, sticker, tumbler, mug: tumbler, cap, patch: cap,
  "tumbler-16oz": tumbler16.url, "chromium-black-yellow": blackSticker.url,
  "chromium-red-white": redSticker.url, "kopi-malay-logo": logoSticker.url,
  "northern-full-loop": loopSticker.url, "pit-stop-south-asia": pitSticker.url,
  "magnet-signage": signage.url, "magnet-south-asia": takMagnet.url, "magnet-tak-city": southMagnet.url,
  "jersey-front-back": jersey.url, "jersey-sleeves": jerseySleeves.url,
  "sticker-ban-maekonken-curve-33": stickerBanMaekonken.url,
  "sticker-black-yellow-tak-route-1": stickerBlackYellow.url,
  "sticker-red-white-tak-route-1": stickerRedWhite.url,
  "sticker-signage-a": stickerSignageA.url,
  "sticker-signage-b": stickerSignageB.url,
  "sticker-umphang-1219-curves": stickerUmphang.url,
};

export function imageFor(key: string | undefined): string {
  if (!key) return tee;
  if (key.startsWith("http") || key.startsWith("/__l5e/assets-v1/")) return key;
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
  price_thb: number | null;
  weight_kg?: number | null;
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

export type Country = "Malaysia" | "Thailand" | "Singapore";
export const APPAREL_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const;
export type ShippingLine = { category_slug: string; quantity: number; weight_kg?: number | null };
export function eastMalaysiaSurcharge(country: Country, state: string): number {
  return country === "Malaysia" && ["Sabah", "Sarawak"].includes(state) ? 10 : 0;
}
export const SINGAPORE_NOTICE = "Direct shipping to Singapore is unavailable. Please arrange self-pickup or delivery through a close contact or friend in Peninsular Malaysia.";
export function shippingFee(country: Country, lines: ShippingLine[], state = ""): number | null {
  if (country === "Singapore") return null;
  if (country === "Thailand") {
    const tumblers = lines.filter((line) => line.category_slug === "tumblers" && line.quantity > 0);
    if (!tumblers.length) return 0;
    if (tumblers.some((line) => line.weight_kg == null || !Number.isFinite(line.weight_kg) || line.weight_kg <= 0)) return null;
    const weight = tumblers.reduce((sum, line) => sum + (line.weight_kg ?? 0) * line.quantity, 0);
    return weight < 1 ? 60 : null;
  }
  let tumblers = 0, apparel = 0, accessories = 0;
  for (const line of lines) {
    if (line.category_slug === "tumblers") tumblers += line.quantity;
    else if (["jerseys-t-shirts", "shirts", "sweaters-jackets"].includes(line.category_slug)) apparel += line.quantity;
    else accessories += line.quantity;
  }
  return 20 * (Math.ceil(tumblers / 2) + Math.ceil(apparel / 2) + Math.ceil(accessories / 20)) + eastMalaysiaSurcharge(country, state);
}
export function destinationPrice(p: Product, country: Country): number | null {
  return country === "Singapore" ? null : country === "Thailand" ? p.price_thb : effectivePrice(p);
}
export function formatMoney(value: number, currency: string): string {
  return `${currency.toLowerCase() === "thb" ? "THB" : "RM"} ${value.toFixed(2)}`;
}
export function shippingDescription(category: string): string {
  const block = category === "tumblers" ? "2 tumblers" : ["jerseys-t-shirts", "shirts", "sweaters-jackets"].includes(category) ? "2 apparel items" : "20 accessories";
  const apparel = ["jerseys-t-shirts", "shirts", "sweaters-jackets"].includes(category);
  const thailand = category === "tumblers" ? "Thailand: THB 60.00 for total tumbler weight under 1kg. Checkout is unavailable until unit weights are configured; orders of 1kg or more require a shipping quote." : "Free shipping to Thailand.";
  return `${thailand} Malaysia: RM 20.00 per block of ${block}. Mixed shipping groups are charged separately. Sabah & Sarawak: an additional flat RM 10.00 per order.${apparel ? ` Shipped from Tak, Thailand across the border via Peninsular Malaysia. ${SINGAPORE_NOTICE}` : ""}`;
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
