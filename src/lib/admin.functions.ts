import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { filterOrders, ordersToCsv, type AdminOrderRow } from "./admin-csv";
import { TOWING_STATUSES } from "./towing";
import { type StockStatus } from "./order-stock";
import { ORDER_ACTIONS, ORDER_FLOW } from "./order-flow";
import { buildRoleChanges, buildRoleIndex, actorBadge, highestRole, orderPlacer, sortUsersByRole, type PlacedBy, type RoleIndex } from "./roles";
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
export type AdminOrder = AdminOrderRow & { id: string; receipt_url: string | null; label_url: string | null; subtotal: number; shipping_fee: number; discount_amount: number; sticker_bundle_discount: number; promo_code: string | null; stock_status: StockStatus; placed_by: PlacedBy | null };

const FilterSchema = z.object({
  q: z.string().max(200).optional(), status: z.string().max(50).optional(), currency: z.enum(["myr", "thb"]).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  placed_by: z.enum(["guest", "customer", "staff", "owner"]).optional(),
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

/** Roles + which accounts still exist, for display badges only. */
async function loadRoleIndex(admin: Awaited<ReturnType<typeof adminClient>>): Promise<RoleIndex> {
  const [{ data: roles }, { data: users }] = await Promise.all([
    admin.from("user_roles").select("user_id,role"),
    admin.auth.admin.listUsers({ perPage: 1000 }),
  ]);
  return buildRoleIndex(roles ?? [], (users?.users ?? []).map((u) => u.id));
}

async function loadOrders(admin: Awaited<ReturnType<typeof adminClient>>): Promise<AdminOrder[]> {
  const idx = await loadRoleIndex(admin);
  const { data, error } = await admin.from("orders")
    .select("id,user_id,order_number,created_at,status,currency,total_amount,subtotal,shipping_fee,discount_amount,sticker_bundle_discount,sale_discount,promo_code,payment_method,tracking_number,tracking_label_path,guest_email,shipping_address,receipt_path,stock_status,order_items(product_name,selected_variant,quantity)")
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
    placed_by: orderPlacer(o.user_id, idx),
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

export type OrderHistoryEntry = { id: string; changed_at: string; changed_by_email: string; from_status: string | null; to_status: string; tracking_number: string | null; old_tracking_number: string | null; pos_receipt_number: string | null; notes: string | null; actor_role: "owner" | "staff" | null };

export const getOrderHistory = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<OrderHistoryEntry[]> => {
    const admin = await adminClient(context as unknown as Ctx);
    const { data: rows, error } = await admin.from("order_status_history").select("id,changed_at,changed_by,changed_by_email,from_status,to_status,tracking_number,old_tracking_number,pos_receipt_number,notes").eq("order_id", data.id).order("changed_at");
    if (error) throw new Error(error.message);
    const idx = await loadRoleIndex(admin);
    return (rows ?? []).map(({ changed_by, ...h }) => ({ ...h, actor_role: actorBadge(changed_by, idx) }));
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
/** Owner-only: verify admin + owner role as the caller before using the service client. */
async function ownerClient(context: Ctx) {
  const { assertOwnerCaller } = await import("./owner-gate.server");
  await assertOwnerCaller(context as never);
  return adminClient(context);
}

export const listUsers = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const admin = await ownerClient(context as unknown as Ctx);
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(error.message);
  const [roles, orders, profiles] = await Promise.all([
    admin.from("user_roles").select("user_id,role").in("role", ["admin", "owner"]),
    admin.from("orders").select("user_id,guest_email"),
    admin.from("profiles").select("id,full_name,phone,city,state,country,motorcycle_make,motorcycle_model,motorcycle_plate,preferred_contact"),
  ]);
  const prof = new Map((profiles.data ?? []).map((p) => [p.id, p]));
  const admins = new Set((roles.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));
  const owners = new Set((roles.data ?? []).filter((r) => r.role === "owner").map((r) => r.user_id));
  return sortUsersByRole(data.users.map((u) => ({
    id: u.id, email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null,
    provider: (u.app_metadata?.["provider"] as string | undefined) ?? "email",
    is_admin: admins.has(u.id),
    is_owner: owners.has(u.id),
    role: highestRole([...(owners.has(u.id) ? ["owner"] : []), ...(admins.has(u.id) ? ["admin"] : [])]),
    email_confirmed: !!u.email_confirmed_at,
    profile: prof.get(u.id) ?? null,
    orders: (orders.data ?? []).filter((o) => o.user_id === u.id || (!!u.email && o.guest_email?.toLowerCase() === u.email.toLowerCase())).length,
  })));
});

/** Owner-only, read-only view of the admin role audit log. */
export const listRoleChanges = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ q: z.string().max(200).optional(), action: z.enum(["all", "grant", "remove"]).optional(), offset: z.number().int().min(0).max(100000).optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const admin = await ownerClient(context as unknown as Ctx);
    const { data: rows, error } = await admin.from("admin_role_audit").select("id,changed_at,action,changed_by,changed_by_email,target_user_id,target_email").order("changed_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    return buildRoleChanges(rows ?? [], await loadRoleIndex(admin), data);
  });

export const setAdminRole = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), admin: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const ctx = context as unknown as Ctx & { claims?: { email?: string } };
    const { runSetAdminRole } = await import("./admin-role.server");
    const { sendTelegram, escHtml } = await import("./telegram.server");
    let admin: Awaited<ReturnType<typeof ownerClient>> | null = null;
    const actorEmail = ctx.claims?.email ?? "";
    let targetEmail = "";
    return runSetAdminRole({ actorId: ctx.userId, actorEmail: escHtml(actorEmail), targetId: data.user_id, grant: data.admin }, {
      assertOwner: async () => { admin = await ownerClient(ctx); },
      getTarget: async (id) => {
        const { data: u, error } = await admin!.auth.admin.getUserById(id);
        if (error || !u.user) return null;
        const { data: o } = await admin!.from("user_roles").select("role").eq("user_id", id).eq("role", "owner").maybeSingle();
        targetEmail = u.user.email ?? "";
        return { email: escHtml(targetEmail), email_confirmed: !!u.user.email_confirmed_at, is_owner: !!o };
      },
      write: async (grant) => {
        const { data: r, error } = await admin!.rpc("set_admin_role_audited", { _actor: ctx.userId, _actor_email: actorEmail, _target: data.user_id, _target_email: targetEmail, _grant: grant });
        if (error) throw new Error(error.message);
        return !!r;
      },
      notify: (text) => sendTelegram(text, "admin-role"),
    });
  });

// ---------- Owner reversals: Undo Verify / Full Refund ----------
export type ReverseOrderResult = { ok: true } | { ok: false; error: string };

export const reverseOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    kind: z.enum(["undo_verify", "refund"]),
    pin: z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits"),
    reason: z.string().trim().min(3, "Reason is required").max(500),
    bank_reference: z.string().trim().max(120).optional(),
    return_to_stock: z.boolean(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<ReverseOrderResult> => {
    const ctx = context as unknown as Ctx & { claims?: { email?: string } };
    const email = ctx.claims?.email ?? "";
    const { assertOwner, verifyOwnerPin } = await import("./owner-pin.server");
    const { runReversal } = await import("./order-reverse.server");
    let admin: Awaited<ReturnType<typeof adminClient>> | null = null;
    const claim = crypto.randomUUID();
    const restock = data.return_to_stock;
    const notes = [
      data.kind === "refund" ? "Full refund" : "Undo Verify",
      `Reason: ${data.reason}`,
      data.bank_reference ? `Bank ref: ${data.bank_reference}` : null,
      restock ? "Items returned to shop (restocked)" : "Items not returned (inventory write-off)",
    ].filter(Boolean).join(" · ");
    const res = await runReversal(data.kind, {
      assertOwner: async () => { await assertOwner(ctx as never); admin = await adminClient(ctx); },
      verifyPin: () => verifyOwnerPin(admin!, ctx.userId, data.pin, email),
      claim: async (allowed) => {
        const { data: prev, error } = await admin!.rpc("claim_order_reverse", { _id: data.id, _claim: claim, _allowed: allowed });
        if (error) throw new Error(error.message);
        return prev;
      },
      pos: async () => {
        const { processOrderPos } = await import("./order-pos.server");
        return processOrderPos(admin!, { id: data.id, action: "restore", actor: ctx.userId, returnToStock: restock });
      },
      release: async () => { await admin!.rpc("release_order_reverse", { _id: data.id, _claim: claim }); },
      refundReceipt: async () => {
        const { data: op } = await admin!.from("order_pos_operations").select("receipt_number").eq("order_id", data.id).eq("kind", "refund").order("cycle", { ascending: false }).limit(1).maybeSingle();
        return op?.receipt_number ?? null;
      },
      finish: async (to, receipt) => {
        const { data: ok, error } = await admin!.rpc("finish_order_reverse", { _id: data.id, _claim: claim, _to: to, _stock: restock ? "restored" : "written_off", _actor: ctx.userId, _actor_email: email, _pos_receipt: receipt ?? "", _notes: notes });
        if (error) throw new Error(error.message);
        return !!ok;
      },
      notify: async (previous, receipt) => {
        // Amount is read from the order record on the server, never from the client.
        const { data: o } = await admin!.from("orders").select("order_number,currency,total_amount").eq("id", data.id).single();
        const { sendTelegram, escHtml } = await import("./telegram.server");
        const amount = o ? `${o.currency === "thb" ? "THB" : "RM"} ${Number(o.total_amount).toFixed(2)}` : "";
        const sent = await sendTelegram([
          data.kind === "refund" ? `💸 <b>Order refunded: ${escHtml(o?.order_number ?? "")}</b>` : `↩️ <b>Verification undone: ${escHtml(o?.order_number ?? "")}</b>`,
          `• Owner: ${escHtml(email)}`,
          `• Previous status: ${escHtml(previous.replace(/_/g, " "))}`,
          `• Amount: ${amount}`,
          `• Reason: ${escHtml(data.reason)}`,
          data.bank_reference ? `• Bank ref: ${escHtml(data.bank_reference)}` : null,
          `• Stock: ${restock ? "returned to shop" : "written off"}`,
          receipt ? `• POS refund receipt: ${escHtml(receipt)}` : null,
        ].filter(Boolean).join("\n"), "reversal");
        if (!sent) throw new Error("Telegram not delivered");
      },
    });
    if (res.ok) return { ok: true };
    if ("pin" in res) {
      const r = res.pin.reason;
      return { ok: false, error: r === "not_set" ? "Set your Owner PIN first." : r === "locked" ? `PIN locked after 5 wrong tries. Try again after ${new Date(res.pin.lockedUntil ?? "").toLocaleTimeString()}.` : "Wrong PIN. Nothing was changed." };
    }
    return { ok: false, error: "Loyverse could not complete this. The order was restored to its previous status." };
  });
