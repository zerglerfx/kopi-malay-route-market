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
  if (key.startsWith("http") || key.startsWith("/__l5e/assets-v1/") || key.startsWith("/api/public/product-image/")) return key;
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
  sale_price_thb?: number | null;
  weight_kg?: number | null;
  images: string[];
  variants: { sizes?: string[] };
  is_featured: boolean;
  is_new_arrival?: boolean;
  stock_qty: number;
  /** Live Loyverse stock per size ("" for one-size items); null when not tracked. */
  stock?: Record<string, number> | null;
  /** Shared one-size inventory pool, when several designs draw from one POS variant. */
  stock_pool?: string;
  category_slug: string;
  category_name: string;
};

export type Category = { id: string; name: string; slug: string };

export function effectivePrice(p: { price: number; sale_price: number | null }): number {
  return p.sale_price != null && p.sale_price < p.price ? p.sale_price : p.price;
}

/** Thai price after an optional THB sale (only when lower than the regular THB price). */
export function effectivePriceThb(p: { price_thb: number | null; sale_price_thb?: number | null }): number | null {
  if (p.price_thb == null) return null;
  return p.sale_price_thb != null && p.sale_price_thb < p.price_thb ? p.sale_price_thb : p.price_thb;
}

/** Per-unit sale saving versus the regular destination price; 0 when not on sale. */
export function saleSavingUnit(regular: number | null, paid: number | null): number {
  if (regular == null || paid == null) return 0;
  return Math.max(0, Math.round((regular - paid) * 100)) / 100;
}

export function isApparel(p: { variants: { sizes?: string[] } }): boolean {
  return (p.variants?.sizes?.length ?? 0) > 0;
}

export const MY_STATES = [
  "Johor", "Kedah", "Kelantan", "Kuala Lumpur", "Labuan", "Melaka", "Negeri Sembilan",
  "Pahang", "Penang", "Perak", "Perlis", "Putrajaya", "Sabah", "Sarawak", "Selangor", "Terengganu",
] as const;

export const TH_PROVINCES = [
  "Amnat Charoen", "Ang Thong", "Bangkok", "Bueng Kan", "Buriram", "Chachoengsao", "Chai Nat", "Chaiyaphum", "Chanthaburi",
  "Chiang Mai", "Chiang Rai", "Chonburi", "Chumphon", "Kalasin", "Kamphaeng Phet", "Kanchanaburi", "Khon Kaen", "Krabi",
  "Lampang", "Lamphun", "Loei", "Lopburi", "Mae Hong Son", "Maha Sarakham", "Mukdahan", "Nakhon Nayok", "Nakhon Pathom",
  "Nakhon Phanom", "Nakhon Ratchasima", "Nakhon Sawan", "Nakhon Si Thammarat", "Nan", "Narathiwat", "Nong Bua Lamphu",
  "Nong Khai", "Nonthaburi", "Pathum Thani", "Pattani", "Phang Nga", "Phatthalung", "Phayao", "Phetchabun", "Phetchaburi",
  "Phichit", "Phitsanulok", "Phra Nakhon Si Ayutthaya", "Phrae", "Phuket", "Prachinburi", "Prachuap Khiri Khan", "Ranong",
  "Ratchaburi", "Rayong", "Roi Et", "Sa Kaeo", "Sakon Nakhon", "Samut Prakan", "Samut Sakhon", "Samut Songkhram", "Saraburi",
  "Satun", "Sing Buri", "Sisaket", "Songkhla", "Sukhothai", "Suphan Buri", "Surat Thani", "Surin", "Tak", "Trang", "Trat",
  "Ubon Ratchathani", "Udon Thani", "Uthai Thani", "Uttaradit", "Yala", "Yasothon",
] as const;

/** Map a saved profile address onto checkout fields; drops a state that doesn't belong to the country. */
export function profileToCheckout(p: { full_name: string; phone: string; address: string; city: string; state: string; postcode: string; country: string }) {
  const country: Country = p.country?.toLowerCase() === "thailand" ? "Thailand" : "Malaysia";
  const list: readonly string[] = country === "Malaysia" ? MY_STATES : TH_PROVINCES;
  return { country, name: p.full_name, phone: p.phone, address: p.address, city: p.city, postcode: p.postcode, state: list.includes(p.state) ? p.state : "" };
}

const EAST = new Set(["Sabah", "Sarawak", "Labuan"]);

export function isEastMalaysia(state: string): boolean {
  return EAST.has(state);
}

export type Country = "Malaysia" | "Thailand";
export const APPAREL_SIZES = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"] as const;
export type ShippingLine = { category_slug: string; quantity: number; weight_kg?: number | null };
/** Sum in integer grams to avoid floating-point threshold drift. Unknown weights stay explicit. */
export function parcelWeight(lines: ShippingLine[]): { kg: number; complete: boolean } {
  let grams = 0;
  let complete = true;
  for (const line of lines) {
    if (line.quantity <= 0) continue;
    if (line.weight_kg == null || !Number.isFinite(line.weight_kg) || line.weight_kg <= 0) {
      complete = false;
      continue;
    }
    grams += Math.round(line.weight_kg * 1000) * line.quantity;
  }
  return { kg: grams / 1000, complete };
}
export function formatParcelWeight(weight: { kg: number; complete: boolean }): string {
  return `${weight.kg.toFixed(3)} kg${weight.complete ? "" : " (known items only)"}`;
}
export function eastMalaysiaSurcharge(country: Country, state: string): number {
  return country === "Malaysia" && ["Sabah", "Sarawak"].includes(state) ? 10 : 0;
}
/** Thailand bills tumbler-only weight in started kilograms; other items remain free. */
export function thailandTumblerShipping(lines: ShippingLine[]) {
  const tumblers = lines.filter((line) => line.category_slug === "tumblers" && line.quantity > 0);
  const weight = parcelWeight(tumblers);
  if (!weight.complete) return null;
  const blocks = Math.ceil(Math.round(weight.kg * 1000) / 1000);
  const base = blocks > 0 ? 60 : 0;
  const surcharge = Math.max(0, blocks - 1) * 60;
  return { weight, blocks, base, surcharge, total: base + surcharge };
}
/** Malaysia quantity-block breakdown; shippingFee sums exactly these groups so displayed lines match the total. */
export function malaysiaShippingBreakdown(lines: ShippingLine[], state = "") {
  let tumblers = 0, apparel = 0, accessories = 0;
  for (const line of lines) {
    if (line.category_slug === "tumblers") tumblers += line.quantity;
    else if (["jerseys-t-shirts", "shirts", "sweaters-jackets"].includes(line.category_slug)) apparel += line.quantity;
    else accessories += line.quantity;
  }
  const group = (label: string, units: number, size: number) => {
    const blocks = Math.ceil(units / size);
    return { label, units, size, blocks, fee: 20 * blocks };
  };
  const groups = [group("Tumblers", tumblers, 2), group("Apparel", apparel, 2), group("Accessories", accessories, 20)];
  const surcharge = eastMalaysiaSurcharge("Malaysia", state);
  return { groups, surcharge, total: groups.reduce((sum, g) => sum + g.fee, 0) + surcharge };
}
export function shippingFee(country: Country, lines: ShippingLine[], state = ""): number | null {
  if (country === "Thailand") {
    return thailandTumblerShipping(lines)?.total ?? null;
  }
  return malaysiaShippingBreakdown(lines, state).total;
}
export function destinationPrice(p: Product, country: Country): number | null {
  return country === "Thailand" ? effectivePriceThb(p) : effectivePrice(p);
}
export function formatMoney(value: number, currency: string): string {
  return `${currency.toLowerCase() === "thb" ? "THB" : "RM"} ${value.toFixed(2)}`;
}
export function shippingDescription(category: string): string {
  const block = category === "tumblers" ? "2 tumblers" : ["jerseys-t-shirts", "shirts", "sweaters-jackets"].includes(category) ? "2 apparel items" : "20 accessories";
  const apparel = ["jerseys-t-shirts", "shirts", "sweaters-jackets"].includes(category);
  const thailand = category === "tumblers" ? "Each tumbler weighs 292g. Thailand: THB 60.00 for the first 1kg of tumbler weight, plus THB 60.00 per additional started kilogram." : "Free shipping to Thailand.";
  return `${thailand} Malaysia: RM 20.00 per block of ${block}. Mixed shipping groups are charged separately. Sabah & Sarawak: an additional flat RM 10.00 per order.${apparel ? " Shipped from Tak, Thailand across the border via Peninsular Malaysia." : ""}`;
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

/** Units available for a product/size, or null when stock is not tracked (unlimited). */
export function availableStock(p: Pick<Product, "stock">, size: string): number | null {
  if (!p.stock) return null;
  return p.stock[size] ?? 0;
}
