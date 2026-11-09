import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdminOrderRow } from "./admin-csv";
import { TOWING_STATUSES } from "./towing";

type Ctx = { supabase: { rpc: (fn: "has_role", args: { _user_id: string; _role: "admin" }) => PromiseLike<{ data: boolean | null }> }; userId: string };

/** Verify the caller is an admin (as the user, via RLS-safe function), then hand back the service client. */
async function adminClient(context: Ctx) {
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
export type AdminOrder = AdminOrderRow & { id: string; receipt_url: string | null; subtotal: number; shipping_fee: number; discount_amount: number; promo_code: string | null };

export const listOrders = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }): Promise<AdminOrder[]> => {
  const admin = await adminClient(context as unknown as Ctx);
  const { data, error } = await admin.from("orders")
    .select("id,order_number,created_at,status,currency,total_amount,subtotal,shipping_fee,discount_amount,promo_code,payment_method,tracking_number,guest_email,shipping_address,receipt_path,order_items(product_name,selected_variant,quantity)")
    .order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error(error.message);
  const paths = (data ?? []).map((o) => o.receipt_path).filter((p): p is string => !!p);
  const signed = paths.length ? (await admin.storage.from("payment-receipts").createSignedUrls(paths, 3600)).data ?? [] : [];
  return (data ?? []).map((o) => ({
    id: o.id, order_number: o.order_number, created_at: o.created_at, status: o.status, currency: o.currency,
    total_amount: Number(o.total_amount), subtotal: Number(o.subtotal), shipping_fee: Number(o.shipping_fee), discount_amount: Number(o.discount_amount),
    promo_code: o.promo_code, payment_method: o.payment_method, tracking_number: o.tracking_number, email: o.guest_email,
    address: (o.shipping_address ?? {}) as AdminOrderRow["address"],
    items: o.order_items ?? [],
    receipt_url: signed.find((s) => s.path === o.receipt_path)?.signedUrl ?? null,
  }));
});

export const updateOrder = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    id: z.string().uuid(),
    status: z.enum(["pending", "paid", "pending_verification", "verified", "rejected", "shipped", "completed"]).optional(),
    tracking_number: z.string().trim().max(80).nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const admin = await adminClient(context as unknown as Ctx);
    const patch: { status?: string; tracking_number?: string | null } = {};
    if (data.status !== undefined) patch.status = data.status;
    if (data.tracking_number !== undefined) patch.tracking_number = data.tracking_number;
    const { error } = await admin.from("orders").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
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
    admin.from("products").select("id,name,slug,description,category_id,price,sale_price,price_thb,weight_kg,images,variants,is_featured,is_new_arrival,is_active").order("created_at"),
    admin.from("categories").select("id,name,slug").order("sort_order"),
    admin.from("product_stock").select("product_id,size,loyverse_variant_id,in_stock,synced_at"),
    admin.from("shared_stock_links").select("product_id,loyverse_variant_id"),
  ]);
  if (p.error) throw new Error(p.error.message);
  return {
    products: (p.data ?? []).map((r) => ({ ...r, price: Number(r.price), sale_price: r.sale_price == null ? null : Number(r.sale_price), price_thb: r.price_thb == null ? null : Number(r.price_thb), weight_kg: r.weight_kg == null ? null : Number(r.weight_kg), sizes: ((r.variants ?? {}) as { sizes?: string[] }).sizes ?? [] })),
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
  const [roles, orders] = await Promise.all([
    admin.from("user_roles").select("user_id,role").eq("role", "admin"),
    admin.from("orders").select("user_id,guest_email"),
  ]);
  const admins = new Set((roles.data ?? []).map((r) => r.user_id));
  return data.users.map((u) => ({
    id: u.id, email: u.email ?? "", created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null,
    provider: (u.app_metadata?.["provider"] as string | undefined) ?? "email",
    is_admin: admins.has(u.id),
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
