// Server-only Loyverse inventory helpers (two-way stock sync).
type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const API = "https://api.loyverse.com/v1.0";

function headers() {
  const token = process.env["LOYVERSE_API_TOKEN"];
  if (!token) throw new Error("Loyverse not configured");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

type Level = { variant_id: string; store_id: string; in_stock: number };

export async function fetchLevels(variantIds: string[]): Promise<Level[]> {
  const out: Level[] = [];
  for (let i = 0; i < variantIds.length; i += 20) {
    let cursor: string | undefined;
    do {
      const url = new URL(`${API}/inventory`);
      url.searchParams.set("variant_ids", variantIds.slice(i, i + 20).join(","));
      url.searchParams.set("limit", "250");
      if (cursor) url.searchParams.set("cursor", cursor);
      const r = await fetch(url, { headers: headers() });
      if (!r.ok) throw new Error(`Loyverse inventory read failed [${r.status}]`);
      const j = (await r.json()) as { inventory_levels?: Level[]; cursor?: string };
      out.push(...(j.inventory_levels ?? []));
      cursor = j.cursor;
    } while (cursor);
  }
  return out;
}

/** Pull Loyverse stock into the website for every mapped variant. */
export async function pullStock(admin: Admin) {
  const { data: rows } = await admin.from("product_stock").select("loyverse_variant_id");
  const ids = [...new Set((rows ?? []).map((r) => r.loyverse_variant_id))];
  if (!ids.length) return 0;
  const levels = await fetchLevels(ids);
  const now = new Date().toISOString();
  for (const id of ids) {
    const qty = levels.filter((l) => l.variant_id === id).reduce((s, l) => s + l.in_stock, 0);
    await admin.from("product_stock").update({ in_stock: Math.max(0, qty), synced_at: now }).eq("loyverse_variant_id", id);
  }
  return ids.length;
}

export type StockDelta = { variantId: string; quantity: number };
export type Shortfall = { variantId: string; needed: number; available: number };

export async function findShortfall(sold: StockDelta[]): Promise<Shortfall[]> {
  if (!sold.length) return [];
  const levels = await fetchLevels(sold.map((s) => s.variantId));
  return sold.map((s) => ({ variantId: s.variantId, needed: s.quantity, available: levels.filter((l) => l.variant_id === s.variantId).reduce((n, l) => n + l.in_stock, 0) }))
    .filter((x) => x.available < x.needed);
}

/** Apply signed deltas (negative = deduct, positive = restore) on top of fresh live Loyverse levels. */
export async function adjustStock(admin: Admin, deltas: StockDelta[], sign: 1 | -1) {
  if (!deltas.length) return;
  const levels = await fetchLevels(deltas.map((s) => s.variantId));
  const updates = deltas.map((s) => {
    const l = levels.find((x) => x.variant_id === s.variantId);
    if (!l) throw new Error(`No Loyverse stock record for ${s.variantId}`);
    return { variant_id: s.variantId, store_id: l.store_id, stock_after: l.in_stock + sign * s.quantity };
  });
  const r = await fetch(`${API}/inventory`, { method: "POST", headers: headers(), body: JSON.stringify({ inventory_levels: updates }) });
  if (!r.ok) throw new Error(`Loyverse inventory update failed [${r.status}]: ${await r.text()}`);
  const now = new Date().toISOString();
  for (const u of updates) await admin.from("product_stock").update({ in_stock: Math.max(0, u.stock_after), synced_at: now }).eq("loyverse_variant_id", u.variant_id);
}

export type PosReceipt = { receipt_number: string; receipt_type: string; refund_for: string | null; order: string | null; total_money: number; line_items: { id: string; variant_id: string; quantity: number }[] };

export async function posRequest<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, { method: body === undefined ? "GET" : "POST", headers: headers(), ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(25000) });
  if (!r.ok) {
    const detail = await r.text();
    console.error(`Loyverse request failed [${r.status}]: ${detail}`);
    throw new Error(`Loyverse rejected the request [${r.status}]: ${detail}`);
  }
  return await r.json() as T;
}

/** Exact order lookup, paginated. Source includes a durable cycle marker. Never match a partial web reference. */
export async function findPosReceipt(ref: string, source: string, kind: "sale" | "refund", original?: string | null) {
  let cursor: string | undefined;
  const matches: PosReceipt[] = [];
  do {
    const q = new URLSearchParams({ order: ref, limit: "250" });
    if (cursor) q.set("cursor", cursor);
    const result = await posRequest<{ receipts: (PosReceipt & { source: string })[]; cursor?: string }>(`/receipts?${q}`);
    matches.push(...result.receipts.filter((r) => r.order === ref && (kind === "sale" ? r.receipt_type === "SALE" && r.source === source : r.receipt_type === "REFUND" && r.refund_for === original)));
    cursor = result.cursor;
  } while (cursor);
  if (matches.length > 1) throw new Error("Multiple matching POS receipts found. Check Loyverse before continuing.");
  return matches[0] ?? null;
}

export async function posSettings() {
  const [stores, payments, taxes] = await Promise.all([
    posRequest<{ stores: { id: string; name: string; deleted_at: string | null }[] }>("/stores"),
    posRequest<{ payment_types: { id: string; name: string; stores: string[]; deleted_at: string | null }[] }>("/payment_types"),
    posRequest<{ taxes: { id: string; type: string; rate: number; stores: string[]; deleted_at: string | null }[] }>("/taxes"),
  ]);
  const store = stores.stores.find((s) => s.name === "KOPI MALAY" && !s.deleted_at);
  const payment = payments.payment_types.find((p) => p.name === "MERCHANDISE QR (WEB)" && !p.deleted_at && store && p.stores.includes(store.id));
  if (!store || !payment) throw new Error("KOPI MALAY store or MERCHANDISE QR (WEB) payment type is unavailable.");
  // Only included VAT: never let an added tax increase discounted merchandise prices.
  const vat = taxes.taxes.find((t) => t.type === "INCLUDED" && t.rate === 7 && !t.deleted_at && t.stores.includes(store.id));
  if (!vat) throw new Error("The store's 7% included VAT is unavailable. Order not verified.");
  return { storeId: store.id, paymentId: payment.id, taxes: [{ id: vat.id }] };
}

export async function writeoffTargets(deltas: StockDelta[], storeId: string) {
  const levels = await fetchLevels(deltas.map((d) => d.variantId));
  return deltas.map((d) => {
    const level = levels.find((l) => l.variant_id === d.variantId && l.store_id === storeId);
    if (!level) throw new Error("Missing store inventory for refunded item.");
    return { variant_id: d.variantId, store_id: storeId, stock_after: level.in_stock - d.quantity };
  });
}

export async function applyWriteoff(targets: { variant_id: string; store_id: string; stock_after: number }[]) {
  await posRequest("/inventory", { inventory_levels: targets });
}

/** Find or create store-scoped variable-amount discounts by name (receipt-level breakdown lines). */
export async function posDiscountIds(storeId: string, names: string[]) {
  if (!names.length) return {} as Record<string, string>;
  const list = await posRequest<{ discounts: { id: string; name: string; type: string; stores: string[]; deleted_at: string | null }[] }>("/discounts");
  const out: Record<string, string> = {};
  for (const name of names) {
    const found = list.discounts.find((d) => d.name === name && d.type === "VARIABLE_AMOUNT" && !d.deleted_at && d.stores.includes(storeId));
    out[name] = found ? found.id : (await posRequest<{ id: string }>("/discounts", { type: "VARIABLE_AMOUNT", name, stores: [storeId] })).id;
  }
  return out;
}
