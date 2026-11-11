import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdminOrderRow } from "./admin-csv";
import { TOWING_STATUSES } from "./towing";
import { planStockAction, type StockStatus } from "./order-stock";
type StockDelta = { variantId: string; quantity: number };

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
export type AdminOrder = AdminOrderRow & { id: string; receipt_url: string | null; label_url: string | null; subtotal: number; shipping_fee: number; discount_amount: number; promo_code: string | null; stock_status: StockStatus };

export const listOrders = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<AdminOrder[]> => {
  const admin = await adminClient(context as unknown as Ctx);
  const { data, error } = await admin.from("orders")
    .select("id,order_number,created_at,status,currency,total_amount,subtotal,shipping_fee,discount_amount,promo_code,payment_method,tracking_number,tracking_label_path,guest_email,shipping_address,receipt_path,stock_status,order_items(product_name,selected_variant,quantity)")
    .order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  const paths = (data ?? []).flatMap((o) => [o.receipt_path, o.tracking_label_path]).filter((p): p is string => !!p);
  const signed = paths.length ? (await admin.storage.from("payment-receipts").createSignedUrls(paths, 3600)).data ?? [] : [];
  return (data ?? []).map((o) => ({
    id: o.id, order_number: o.order_number, created_at: o.created_at, status: o.status, currency: o.currency,
    total_amount: Number(o.total_amount), subtotal: Number(o.subtotal), shipping_fee: Number(o.shipping_fee), discount_amount: Number(o.discount_amount),
    promo_code: o.promo_code, payment_method: o.payment_method, tracking_number: o.tracking_number, email: o.guest_email,
    address: (o.shipping_address ?? {}) as AdminOrderRow["address"],
    items: o.order_items ?? [],
    stock_status: o.stock_status as StockStatus,
    receipt_url: signed.find((s) => s.path === o.receipt_path)?.signedUrl ?? null,
    label_url: o.tracking_label_path ? signed.find((s) => s.path === o.tracking_label_path)?.signedUrl ?? null : null,
  }));
});

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
    status: z.enum(["pending", "paid", "pending_verification", "verified", "rejected", "shipped", "completed"]).optional(),
    tracking_number: z.string().trim().max(80).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; shortfall: { item: string; needed: number; available: number }[] }> => {
    const admin = await adminClient(context as unknown as Ctx);
    const patch: { status?: string; tracking_number?: string | null } = {};
    if (data.tracking_number !== undefined) patch.tracking_number = data.tracking_number;
    if (data.status !== undefined) {
      const { data: cur, error: e } = await admin.from("orders").select("stock_status,stock_deductions").eq("id", data.id).single();
      if (e || !cur) throw new Error(e?.message ?? "Order not found");
      const prev = cur.stock_status as StockStatus;
      const action = planStockAction(prev, data.status);
      if (action !== "none") {
        const deltas = (cur.stock_deductions ?? []) as StockDelta[];
        // Atomic claim: only one request can move the order out of `prev`.
        const { data: claimed } = await admin.from("orders").update({ stock_status: action === "deduct" ? "deducting" : "restoring" }).eq("id", data.id).eq("stock_status", prev).select("id");
        if (!claimed?.length) throw new Error("This order's stock was just updated elsewhere. Refresh and try again.");
        const revert = () => admin.from("orders").update({ stock_status: prev }).eq("id", data.id);
        try {
          const lv = await import("./loyverse.server");
          if (action === "deduct") {
            const short = await lv.findShortfall(deltas);
            if (short.length) {
              await revert();
              return { ok: false, shortfall: await describeShortfall(admin, short) };
            }
          }
          await lv.adjustStock(admin, deltas, action === "deduct" ? -1 : 1);
        } catch (err) {
          await revert();
          console.error("Loyverse stock update failed", err);
          throw new Error(`Could not ${action === "deduct" ? "deduct" : "restore"} stock in Loyverse. Status not changed. Please try again.`);
        }
        const now = new Date().toISOString();
        const { error } = await admin.from("orders").update(action === "deduct"
          ? { ...patch, status: data.status, stock_status: "deducted", stock_deducted_at: now }
          : { ...patch, status: data.status, stock_status: "restored", stock_restored_at: now }).eq("id", data.id);
        if (error) throw new Error(error.message);
        return { ok: true };
      }
      patch.status = data.status;
    }
    const { error } = await admin.from("orders").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
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
    admin.from("products").select("id,name,slug,description,category_id,price,sale_price,price_thb,sale_price_thb,weight_kg,images,variants,is_featured,is_new_arrival,is_active").order("created_at"),
    admin.from("categories").select("id,name,slug").order("sort_order"),
    admin.from("product_stock").select("product_id,size,loyverse_variant_id,in_stock,synced_at"),
    admin.from("shared_stock_links").select("product_id,loyverse_variant_id"),
  ]);
  if (p.error) throw new Error(p.error.message);
  return {
    products: (p.data ?? []).map((r) => ({ ...r, price: Number(r.price), sale_price: r.sale_price == null ? null : Number(r.sale_price), price_thb: r.price_thb == null ? null : Number(r.price_thb), sale_price_thb: r.sale_price_thb == null ? null : Number(r.sale_price_thb), weight_kg: r.weight_kg == null ? null : Number(r.weight_kg), sizes: ((r.variants ?? {}) as { sizes?: string[] }).sizes ?? [] })),
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
