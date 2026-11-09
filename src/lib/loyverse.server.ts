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
  for (let i = 0; i < variantIds.length; i += 100) {
    let cursor: string | undefined;
    do {
      const url = new URL(`${API}/inventory`);
      url.searchParams.set("variant_ids", variantIds.slice(i, i + 100).join(","));
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
  const ids = (rows ?? []).map((r) => r.loyverse_variant_id);
  if (!ids.length) return 0;
  const levels = await fetchLevels(ids);
  const now = new Date().toISOString();
  for (const id of ids) {
    const qty = levels.filter((l) => l.variant_id === id).reduce((s, l) => s + l.in_stock, 0);
    await admin.from("product_stock").update({ in_stock: Math.max(0, qty), synced_at: now }).eq("loyverse_variant_id", id);
  }
  return ids.length;
}

/** Deduct sold quantities in Loyverse after a web order. */
export async function pushSale(admin: Admin, sold: { variantId: string; quantity: number }[]) {
  if (!sold.length) return;
  const levels = await fetchLevels(sold.map((s) => s.variantId));
  const updates = sold.map((s) => {
    const l = levels.find((x) => x.variant_id === s.variantId);
    if (!l) throw new Error(`No Loyverse stock record for ${s.variantId}`);
    return { variant_id: s.variantId, store_id: l.store_id, stock_after: l.in_stock - s.quantity };
  });
  const r = await fetch(`${API}/inventory`, { method: "POST", headers: headers(), body: JSON.stringify({ inventory_levels: updates }) });
  if (!r.ok) throw new Error(`Loyverse inventory update failed [${r.status}]: ${await r.text()}`);
  const now = new Date().toISOString();
  for (const u of updates) await admin.from("product_stock").update({ in_stock: Math.max(0, u.stock_after), synced_at: now }).eq("loyverse_variant_id", u.variant_id);
}
