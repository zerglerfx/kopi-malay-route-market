import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filterOrders, ordersToCsv, type AdminOrderRow } from "./admin-csv";
import { TOWING_STATUSES } from "./towing";
import { type StockStatus } from "./order-stock";
import { ORDER_ACTIONS, ORDER_FLOW } from "./order-flow";
type StockDelta = { variantId: string; quantity: number };
type UpdateResult = { ok: true } | { ok: false; shortfall: { item: string; needed: number; available: number }[] } | { ok: false; promoConfirmation: { paidDiscount: number; currency: string; maxThb: number } } | { ok: false; returnStockRequired: true };

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }; userId: string };

/** Verify the caller is an admin (as the user, via RLS-safe function), then hand back the service client. */
async function adminClient(context: Ctx) {
  if (!context?.supabase?.rpc || !context.userId) throw new Error("Please sign in again to use the admin dashboard");
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden: admin access required");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}


export const checkAdmin = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await adminClient(context as unknown as Ctx);
  return true;
});

// ---------- Orders ----------
export type AdminOrder = AdminOrderRow & { id: string; receipt_url: string | null; label_url: string | null; subtotal: number; shipping_fee: number; discount_amount: number; sticker_bundle_discount: number; promo_code: string | null; stock_status: StockStatus };

const FilterSchema = z.object({
  q: z.string().max(200).optional(), status: z.string().max(50).optional(), currency: z.enum(["myr", "thb"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).optional();

export const listOrders = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<AdminOrder[]> => {
  const admin = await adminClient(context as unknown as Ctx);
  return loadOrders(admin);
});

/** Admin-only CSV of the orders matching the given filters (role re-checked on the server). */
export const exportOrdersCsv = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => FilterSchema.parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient(context as unknown as Ctx);
    return ordersToCsv(filterOrders(await loadOrders(admin), data ?? {}));
  });

async function loadOrders(admin: Awaited<ReturnType<typeof adminClient>>): Promise<AdminOrder[]> {
  const { data, error } = await admin.from("orders")
    .select("id,order_number,created_at,status,currency,total_amount,subtotal,shipping_fee,discount_amount,sticker_bundle_discount,sale_discount,promo_code,payment_method,tracking_number,tracking_label_path,guest_email,shipping_address,receipt_path,stock_status,order_items(product_name,selected_variant,quantity)")
    .order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  const { data: posRows, error: posError } = await admin.from("order_pos_operations").select("order_id,cycle,kind,receipt_number,total_thb,promo_thb,confirmed_by,created_at").in("order_id", (data ?? []).map((o) => o.id)).order("cycle").order("created_at");
  if (posError) throw new Error(posError.message);
  const paths = (data ?? []).flatMap((o) => [o.receipt_path, o.tracking_label_path]).filter((p): p is string => !!p);
  const signed = paths.length ? (await admin.storage.from("payment-receipts").createSignedUrls(paths, 3600)).data ?? [] : [];
  return (data ?? []).map((o) => ({
    id: o.id, order_number: o.order_number, created_at: o.created_at, status: o.status, currency: o.currency,
    total_amount: Number(o.total_amount), subtotal: Number(o.subtotal), shipping_fee: Number(o.shipping_fee), discount_amount: Number(o.discount_amount), sticker_bundle_discount: Number(o.sticker_bundle_discount ?? 0), sale_discount: Number(o.sale_discount ?? 0),
    promo_code: o.promo_code, payment_method: o.payment_method, tracking_number: o.tracking_number, email: o.guest_email,
    address: (o.shipping_address ?? {}) as AdminOrderRow["address"],
    items: o.order_items ?? [],
    pos_history: (posRows ?? []).filter((p) => p.order_id === o.id).map((p) => ({ cycle: p.cycle, kind: p.kind, receipt_number: p.receipt_number, total_thb: p.total_thb == null ? null : Number(p.total_thb), promo_thb: p.promo_thb == null ? null : Number(p.promo_thb), confirmed_by: p.confirmed_by, created_at: p.created_at })),
    stock_status: o.stock_status as StockStatus,
    receipt_url: signed.find((s) => s.path === o.receipt_path)?.signedUrl ?? null,
    label_url: o.tracking_label_path ? signed.find((s) => s.path === o.tracking_label_path)?.signedUrl ?? null : null,
  }));
}

const LABEL_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as const;

/** Upload (or clear) the courier label image (e.g. J&T QR / barcode slip) for an order. */
export const setTrackingLabel = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    dataUrl: z.string().max(7_500_000).nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient(context as unknown as Ctx);
    const { data: order, error: e1 } = await admin.from("orders").select("tracking_label_path").eq("id", data.id).single();
    if (e1) throw new Error(e1.message);
    let path: string | null = null;
    if (data.dataUrl) {
      const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(data.dataUrl);
      if (!m) throw new Error("Label must be a PNG, JPG or WEBP image");
      const type = m[1] as keyof typeof LABEL_TYPES;
      const bytes = Uint8Array.from(atob(m[2]!), (c) => c.charCodeAt(0));
      if (bytes.byteLength > 5 * 1024 * 1024) throw new Error("Label image must be 5MB or smaller");
      path = `tracking-labels/${data.id}/${Date.now()}.${LABEL_TYPES[type]}`;
      const { error } = await admin.storage.from("payment-receipts").upload(path, bytes, { contentType: type });
      if (error) throw new Error(error.message);
    }
    const { error } = await admin.from("orders").update({ tracking_label_path: path }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (order?.tracking_label_path) await admin.storage.from("payment-receipts").remove([order.tracking_label_path]);
    return { ok: true };
  });

export const updateOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    action: z.enum(ORDER_ACTIONS),
    tracking_number: z.string().trim().max(80).optional(),
    promo_thb: z.number().min(0).max(10000000).multipleOf(0.01).optional(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<UpdateResult> => {
    const ctx = context as unknown as Ctx & { claims?: { email?: string } };
    const admin = await adminClient(ctx);
    const actor = { _actor: ctx.userId, _actor_email: ctx.claims?.email ?? "" };
    const conflict = "This order was just changed by someone else. Refresh and try again.";
    if (data.action !== "verify") {
      const [from, to] = ORDER_FLOW[data.action];
      const tracking = data.tracking_number || undefined;
      if ((data.action === "ship" || data.action === "tracking") && !tracking) throw new Error("Enter a tracking number first.");
      if (data.action === "reject") {
        const { data: ops, error: opError } = await admin.from("order_pos_operations").select("kind,state,receipt_number").eq("order_id", data.id).order("cycle", { ascending: false }).order("created_at", { ascending: false }).limit(1);
        if (opError) throw new Error(opError.message);
        const op = ops?.[0];
        if (op && (["submitting", "uncertain", "receipt_saved"].includes(op.state) || (op.kind === "sale" && op.receipt_number))) throw new Error("Finish reconciling the interrupted POS verification before rejecting this order.");
      }
      const { data: ok, error } = await admin.rpc("transition_order_status", { _id: data.id, _from: from, _to: to, ...actor, ...(tracking ? { _tracking: tracking } : {}) });
      if (error) throw new Error(error.message);
      if (!ok) throw new Error(conflict);
      return { ok: true };
    }
    // Verify: claim (pending_verification -> verifying) before calling the POS.
    const claim = crypto.randomUUID();
    const { data: prev, error: claimError } = await admin.rpc("claim_order_verify", { _id: data.id, _claim: claim });
    if (claimError) throw new Error(claimError.message);
    if (!prev) throw new Error(conflict);
    const revert = () => admin.from("orders").update({ status: "pending_verification", stock_status: prev, pos_claim_id: null, pos_claim_until: null }).eq("id", data.id).eq("pos_claim_id", claim);
    let deltas: StockDelta[];
    try {
      const { processOrderPos } = await import("./order-pos.server");
      const result = await processOrderPos(admin, { id: data.id, action: "deduct", actor: ctx.userId, promoThb: data.promo_thb });
      if (!result.ok) {
        await revert();
        if ("shortfall" in result) return { ok: false, shortfall: await describeShortfall(admin, result.shortfall) };
        return result;
      }
      deltas = result.deltas;
    } catch (err) {
      await revert();
      console.error("Loyverse verification failed", err);
      throw new Error(err instanceof Error ? err.message : "Loyverse update failed. Order is back to Pending Verification.");
    }
    const { data: op } = await admin.from("order_pos_operations").select("receipt_number").eq("order_id", data.id).eq("kind", "sale").order("cycle", { ascending: false }).limit(1).maybeSingle();
    const { data: ok, error } = await admin.rpc("transition_order_status", { _id: data.id, _from: "verifying", _to: "verified", ...actor, ...(op?.receipt_number ? { _pos_receipt: op.receipt_number } : {}), _claim: claim, _deltas: deltas as unknown as never });
    if (error || !ok) { await revert(); throw new Error(error?.message ?? conflict); }
    return { ok: true };
  });

export type OrderHistoryEntry = { id: string; changed_at: string; changed_by_email: string; from_status: string | null; to_status: string; tracking_number: string | null; old_tracking_number: string | null; pos_receipt_number: string | null; notes: string | null };

export const getOrderHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<OrderHistoryEntry[]> => {
    const admin = await adminClient(context as unknown as Ctx);
    const { data: rows, error } = await admin.from("order_status_history").select("id,changed_at,changed_by_email,from_status,to_status,tracking_number,old_tracking_number,pos_receipt_number,notes").eq("order_id", data.id).order("changed_at");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

async function describeShortfall(admin: Awaited<ReturnType<typeof adminClient>>, short: { variantId: string; needed: number; available: number }[]) {
  const ids = short.map((s) => s.variantId);
  const [{ data: direct }, { data: shared }] = await Promise.all([
    admin.from("product_stock").select("loyverse_variant_id,size,products(name)").in("loyverse_variant_id", ids),
    admin.from("shared_stock_links").select("loyverse_variant_id").in("loyverse_variant_id", ids),
  ]);
  return short.map((s) => {
    const r = direct?.find((d) => d.loyverse_variant_id === s.variantId) as { size: string; products: { name: string } | null } | undefined;
    const pooled = shared?.some((x) => x.loyverse_variant_id === s.variantId);
    const item = pooled ? "Shared sticker pool" : `${r?.products?.name ?? "Item"}${r?.size ? ` (Size ${r.size})` : ""}`;
    return { item, needed: s.needed, available: Math.max(0, s.available) };
  });
}

/** Record-only: mark a legacy order's stock as restored/deducted after fixing Loyverse by hand. Never touches Loyverse. */
export const markOrderStock = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), stock_status: z.enum(["restored", "deducted"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient(context as unknown as Ctx);
    const now = new Date().toISOString();
    const { data: rows, error } = await admin.from("orders").update(data.stock_status === "restored" ? { stock_status: "restored", stock_restored_at: now } : { stock_status: "deducted", stock_deducted_at: now })
      .eq("id", data.id).eq("stock_status", "unknown").select("id");
    if (error) throw new Error(error.message);
    if (!rows?.length) throw new Error("Only orders marked 'Check manually' can be updated this way.");
    return { ok: true };
  });

// ---------- Promo codes ----------
const PromoSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(40).transform((s) => s.toUpperCase()),
  discount_type: z.enum(["percentage", "fixed_amount"]),
  discount_value: z.number().min(0).max(100000),
  discount_myr: z.number().min(0).nullable(),
  discount_thb: z.number().min(0).nullable(),
  receipt_discount_thb: z.number().min(0).max(10000000).multipleOf(0.01).nullable().default(null),
  min_order_myr: z.number().min(0).nullable(),
  min_order_thb: z.number().min(0).nullable(),
  max_uses: z.number().int().min(1).nullable(),
  is_active: z.boolean(),
  expires_at: z.string().nullable(),
});

export const listPromos = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await adminClient(context as unknown as Ctx);
  const { data, error } = await admin.from("promo_codes").select("*").order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const savePromo = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => PromoSchema.parse(d)).handler(async ({ data, context }) => {
  const admin = await adminClient(context as unknown as Ctx);
  const { id, ...row } = data;
  const res = id ? await admin.from("promo_codes").update(row).eq("id", id) : await admin.from("promo_codes").insert(row);
  if (res.error) throw new Error(res.error.code === "23505" ? "That code already exists" : res.error.message);
  return { ok: true };
});

// ---------- Products ----------
const ProductSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  slug: z.string().trim().min(1).max(200).regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers and dashes"),
  description: z.string().max(5000),
  category_id: z.string().uuid(),
  price: z.number().min(0),
  sale_price: z.number().min(0).nullable(),
  price_thb: z.number().min(0).nullable(),
  sale_price_thb: z.number().min(0).nullable(),
  receipt_thb_rm_sale: z.number().min(0).max(10000000).multipleOf(0.01).nullable().default(null),
  weight_kg: z.number().min(0).max(100).nullable(),
  images: z.array(z.string().trim().min(1)).max(12),
  sizes: z.array(z.string().trim().min(1)).max(12),
  is_featured: z.boolean(),
  is_new_arrival: z.boolean(),
  is_active: z.boolean(),
});

export const listAdminProducts = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await adminClient(context as unknown as Ctx);
  const [p, c, s, l] = await Promise.all([
    admin.from("products").select("id,name,slug,description,category_id,price,sale_price,price_thb,sale_price_thb,receipt_thb_rm_sale,weight_kg,images,variants,is_featured,is_new_arrival,is_active").order("created_at"),
    admin.from("categories").select("id,name,slug").order("sort_order"),
    admin.from("product_stock").select("product_id,size,loyverse_variant_id,in_stock,synced_at"),
    admin.from("shared_stock_links").select("product_id,loyverse_variant_id"),
  ]);
  if (p.error) throw new Error(p.error.message);
  return {
    products: (p.data ?? []).map((r) => ({ ...r, price: Number(r.price), sale_price: r.sale_price == null ? null : Number(r.sale_price), price_thb: r.price_thb == null ? null : Number(r.price_thb), sale_price_thb: r.sale_price_thb == null ? null : Number(r.sale_price_thb), receipt_thb_rm_sale: r.receipt_thb_rm_sale == null ? null : Number(r.receipt_thb_rm_sale), weight_kg: r.weight_kg == null ? null : Number(r.weight_kg), sizes: ((r.variants ?? {}) as { sizes?: string[] }).sizes ?? [] })),
    categories: c.data ?? [],
    stock: (s.data ?? []).map((x) => ({ ...x, in_stock: Number(x.in_stock) })),
    shared: l.data ?? [],
  };
});

export const saveProduct = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: unknown) => ProductSchema.parse(d)).handler(async ({ data, context }) => {
  const admin = await adminClient(context as unknown as Ctx);
  const { id, sizes, ...rest } = data;
  const row = { ...rest, variants: sizes.length ? { sizes } : {} };
  const res = id ? await admin.from("products").update(row).eq("id", id) : await admin.from("products").insert(row);
  if (res.error) throw new Error(res.error.code === "23505" ? "That slug is already used" : res.error.message);
  return { ok: true };
});

// ---------- Loyverse ----------
export const syncLoyverseStock = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await adminClient(context as unknown as Ctx);
  const { pullStock } = await import("./loyverse.server");
  return { variants: await pullStock(admin) };
});

export const listLoyverseVariants = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await adminClient(context as unknown as Ctx);
  const token = process.env["LOYVERSE_API_TOKEN"];
  if (!token) throw new Error("Loyverse not configured");
  const out: { variant_id: string; label: string }[] = [];
  let cursor: string | undefined;
  do {
    const url = new URL("https://api.loyverse.com/v1.0/items");
    url.searchParams.set("limit", "250");
    if (cursor) url.searchParams.set("cursor", cursor);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Loyverse items read failed [${r.status}]`);
    const j = (await r.json()) as { items?: { item_name: string; variants?: { variant_id: string; option1_value?: string | null; option2_value?: string | null; sku?: string | null }[] }[]; cursor?: string };
    for (const it of j.items ?? []) for (const v of it.variants ?? []) {
      const opt = [v.option1_value, v.option2_value].filter(Boolean).join(" / ");
      out.push({ variant_id: v.variant_id, label: `${it.item_name}${opt ? ` — ${opt}` : ""}${v.sku ? ` (${v.sku})` : ""}` });
    }
    cursor = j.cursor;
  } while (cursor);
  return out.sort((a, b) => a.label.localeCompare(b.label));
});

export const linkStock = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid(), size: z.string().max(20), loyverse_variant_id: z.string().min(1).max(64).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient(context as unknown as Ctx);
    await admin.from("product_stock").delete().eq("product_id", data.product_id).eq("size", data.size);
    if (data.loyverse_variant_id) {
      const { error } = await admin.from("product_stock").insert({ product_id: data.product_id, size: data.size, loyverse_variant_id: data.loyverse_variant_id, in_stock: 0 });
      if (error) throw new Error(error.code === "23505" ? "That Loyverse item is already linked to another product" : error.message);
      const { pullStock } = await import("./loyverse.server");
      await pullStock(admin).catch((e) => console.error("Loyverse pull after link failed", e));
    }
    return { ok: true };
  });

// ---------- Towing ----------
export const listTowing = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await adminClient(context as unknown as Ctx);
  const { data, error } = await admin.from("towing_requests").select("*").order("created_at", { ascending: false }).limit(500);
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const updateTowing = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(TOWING_STATUSES) }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient(context as unknown as Ctx);
    const { error } = await admin.from("towing_requests").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Users ----------
export const listUsers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await adminClient(context as unknown as Ctx);
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  const [roles, orders, profiles] = await Promise.all([
    admin.from("user_roles").select("user_id,role").eq("role", "admin"),
    admin.from("orders").select("user_id,guest_email"),
    admin.from("profiles").select("id,full_name,phone,city,state,country,motorcycle_make,motorcycle_model,motorcycle_plate,preferred_contact"),
  ]);
  const prof = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const admins = new Set((roles.data ?? []).map((r) => r.user_id));
  return data.users.map((u) => ({
    id: u.id, email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null,
    provider: (u.app_metadata?.["provider"] as string | undefined) ?? "email",
    is_admin: admins.has(u.id),
    profile: prof.get(u.id) ?? null,
    orders: (orders.data ?? []).filter((o) => o.user_id === u.id || (!!u.email && o.guest_email?.toLowerCase() === u.email.toLowerCase())).length,
  }));
});

export const setAdminRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), admin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient(context as unknown as Ctx);
    if (!data.admin && data.user_id === (context as unknown as Ctx).userId) throw new Error("You can't remove your own admin access");
    const res = data.admin
      ? await admin.from("user_roles").upsert({ user_id: data.user_id, role: "admin" }, { onConflict: "user_id,role" })
      : await admin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "admin");
    if (res.error) throw new Error(res.error.message);
    return { ok: true };
  });
