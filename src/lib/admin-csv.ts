export type AdminOrderRow = {
  order_number: string;
  created_at: string;
  status: string;
  currency: string;
  total_amount: number;
  subtotal?: number;
  shipping_fee?: number;
  discount_amount?: number;
  sticker_bundle_discount?: number;
  promo_code?: string | null;
  payment_method: string;
  tracking_number: string | null;
  email: string | null;
  address: { name?: string; phone?: string; address?: string; city?: string; state?: string; postcode?: string; country?: string };
  items: { product_name: string; selected_variant: string; quantity: number }[];
  pos_history?: { cycle: number; kind: string; receipt_number: string | null; total_thb?: number | null; promo_thb?: number | null; confirmed_by?: string | null; created_at: string }[];
};

export const CSV_HEADERS = [
  "NO.", "Name", "Address", "Phone Number", "Email", "Order Ref", "Payment", "Status", "Items",
  "Subtotal", "Bundle Savings", "Promo Code", "Promo Discount", "Shipping", "Total", "Currency", "Tracking No.", "Date", "POS Receipt History",
];

/** Statuses the app uses today; any other status found on orders is added automatically. */
export const BASE_STATUSES = ["pending", "pending_verification", "verified", "shipped", "completed", "rejected", "paid"];
export const statusOptions = (rows: { status: string }[]) => Array.from(new Set([...BASE_STATUSES, ...rows.map((r) => r.status)]));

export const fullAddress = (a: AdminOrderRow["address"]) =>
  [a.address, a.postcode && a.city ? `${a.postcode} ${a.city}` : a.city ?? a.postcode, a.state, a.country].filter(Boolean).join(", ");

export const itemsText = (items: AdminOrderRow["items"]) =>
  items.map((i) => `${i.quantity} × ${i.product_name}${i.selected_variant ? ` (${i.selected_variant})` : ""}`).join("; ");

/** Money breakdown in the same order as the Telegram alert: Subtotal − Bundle − Promo + Shipping = Total. */
export function orderTotals(o: AdminOrderRow) {
  const subtotal = Number(o.subtotal ?? 0), bundle = Number(o.sticker_bundle_discount ?? 0), promo = Number(o.discount_amount ?? 0);
  const shipping = Number(o.shipping_fee ?? 0), total = Number(o.total_amount);
  return { currency: o.currency.toUpperCase(), subtotal, bundle, promo, promoCode: o.promo_code ?? null, shipping, total };
}

export const money = (currency: string, n: number) => (currency.toLowerCase() === "myr" ? `RM ${n.toFixed(2)}` : `THB ${n.toFixed(2)}`);

export type OrderFilters = { q?: string | undefined; status?: string | undefined; currency?: string | undefined; from?: string | undefined; to?: string | undefined };

export const digits = (s: string) => s.replace(/\D/g, "");

/** Search (ref, name, email, phone digits, product) + status, currency and date range (YYYY-MM-DD, inclusive). */
export function filterOrders<T extends AdminOrderRow>(rows: T[], f: OrderFilters): T[] {
  const q = (f.q ?? "").trim().toLowerCase();
  const qd = digits(q);
  return rows.filter((o) => {
    if (f.status && o.status !== f.status) return false;
    if (f.currency && o.currency.toLowerCase() !== f.currency.toLowerCase()) return false;
    const day = o.created_at.slice(0, 10);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    if (!q) return true;
    const text = [o.order_number, o.address.name, o.email, ...(o.pos_history ?? []).map((r) => r.receipt_number), ...o.items.map((i) => i.product_name)].filter(Boolean).join(" ").toLowerCase();
    if (text.includes(q)) return true;
    return qd.length >= 3 && digits(o.address.phone ?? "").includes(qd);
  });
}

const quote = (s: string) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

const cell = (v: unknown) => {
  let s = String(v ?? "");
  // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR) for text cells.
  if (typeof v !== "number" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return quote(s);
};

/** Phone stays text (keeps leading 0 / +) only when it is digits with an optional leading +; anything else is a normal guarded text cell. */
export const phoneCell = (v: string | null | undefined) => {
  const s = (v ?? "").trim();
  return /^\+?\d+$/.test(s) ? `"=""${s}"""` : cell(v);
};

/** Excel-friendly CSV (UTF-8 BOM, CRLF). Rows are numbered in the order given. */
export function ordersToCsv(rows: AdminOrderRow[]): string {
  const lines = rows.map((r, i) => {
    const t = orderTotals(r);
    return [
      cell(i + 1), cell(r.address.name), cell(fullAddress(r.address)), phoneCell(r.address.phone), cell(r.email), cell(r.order_number),
      cell(r.payment_method), cell(r.status), cell(itemsText(r.items)),
      cell(t.subtotal.toFixed(2)), cell(t.bundle.toFixed(2)), cell(t.promoCode ?? ""), cell(t.promo.toFixed(2)), cell(t.shipping.toFixed(2)), cell(t.total.toFixed(2)),
      cell(t.currency), cell(r.tracking_number), cell(r.created_at.slice(0, 10)),
      cell((r.pos_history ?? []).filter((p) => p.receipt_number).map((p) => `${p.kind} ${p.cycle}: ${p.receipt_number}`).join("; ")),
    ].join(",");
  });
  return "\uFEFF" + [CSV_HEADERS.join(","), ...lines].join("\r\n");
}
