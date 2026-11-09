import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { effectivePrice, formatMoney, shippingFee } from "./shop";
import { CheckoutDetails, validateDeliveryState } from "./checkout-validation";
import { computePromoDiscount, type Promo } from "./promo";
import { makeOrderRef, ORDER_REF_RE, receiptError } from "./manual-order";

const CheckoutInput = CheckoutDetails.extend({
  ref: z.string().regex(ORDER_REF_RE).optional(),
  promoCode: z.string().trim().max(40).optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variant: z.string().max(20),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(50),
}).superRefine(validateDeliveryState);

function magicOk(bytes: Uint8Array, type: string): boolean {
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "application/pdf") return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  return false;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function notifyTelegram(text: string, receiptUrl: string, isPdf: boolean) {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const tgKey = process.env["TELEGRAM_API_KEY"];
  if (!lovableKey || !tgKey) { console.error("Telegram not configured"); return; }
  const base = "https://connector-gateway.lovable.dev/telegram";
  const headers = { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": tgKey, "Content-Type": "application/json" };
  let chatId = process.env["TELEGRAM_CHAT_ID"];
  if (!chatId) {
    const r = await fetch(`${base}/getUpdates`, { method: "POST", headers, body: "{}" });
    const j = (await r.json()) as { result?: { message?: { chat?: { id: number } }; my_chat_member?: { chat?: { id: number } } }[] };
    const last = [...(j.result ?? [])].reverse().find((u) => u.message?.chat?.id ?? u.my_chat_member?.chat?.id);
    const id = last?.message?.chat?.id ?? last?.my_chat_member?.chat?.id;
    if (!id) { console.error("No Telegram chat found; message the bot first"); return; }
    chatId = String(id);
  }
  const res = await fetch(`${base}/sendMessage`, { method: "POST", headers, body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }) });
  if (!res.ok) console.error(`Telegram sendMessage failed [${res.status}]: ${await res.text()}`);
  const doc = await fetch(`${base}/${isPdf ? "sendDocument" : "sendPhoto"}`, { method: "POST", headers, body: JSON.stringify({ chat_id: chatId, [isPdf ? "document" : "photo"]: receiptUrl }) });
  if (!doc.ok) console.error(`Telegram receipt send failed [${doc.status}]: ${await doc.text()}`);
}

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function loadPromo(admin: Admin, code: string): Promise<Promo | null> {
  const { data } = await admin.from("promo_codes").select("*").ilike("code", code.replace(/[%_\\]/g, "")).maybeSingle();
  if (!data) return null;
  const n = (v: unknown) => (v == null ? null : Number(v));
  return { ...data, discount_value: Number(data.discount_value), discount_myr: n(data.discount_myr), discount_thb: n(data.discount_thb), min_order_myr: n(data.min_order_myr), min_order_thb: n(data.min_order_thb) } as Promo;
}

const PromoInput = z.object({
  code: z.string().trim().min(1).max(40),
  country: z.enum(["Malaysia", "Thailand"]),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(50) })).min(1).max(50),
});

export const validatePromoCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => PromoInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ids = [...new Set(data.items.map((i) => i.productId))];
    const { data: products } = await supabaseAdmin.from("products").select("id,price,sale_price,price_thb").eq("is_active", true).in("id", ids);
    const subtotal = data.items.reduce((s, i) => {
      const p = products?.find((x) => x.id === i.productId);
      if (!p) return s;
      const unit = data.country === "Thailand" ? Number(p.price_thb ?? 0) : effectivePrice({ price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) });
      return s + unit * i.quantity;
    }, 0);
    const promo = await loadPromo(supabaseAdmin, data.code);
    const r = computePromoDiscount(promo, subtotal, data.country === "Thailand" ? "thb" : "myr");
    return r.ok ? { ok: true as const, code: promo!.code.toUpperCase(), discount: r.discount, label: r.label } : { ok: false as const, error: r.error };
  });

export const submitManualOrder = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    if (!(d instanceof FormData)) throw new Error("Invalid form");
    const file = d.get("receipt");
    if (!(file instanceof File)) throw new Error("Please upload your payment proof.");
    const err = receiptError(file);
    if (err) throw new Error(err);
    const payload = CheckoutInput.parse(JSON.parse(String(d.get("payload") ?? "{}")));
    return { ...payload, receipt: file };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const req = getRequest();

    let userId: string | null = null;
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
      userId = u.user?.id ?? null;
    }

    const bytes = new Uint8Array(await data.receipt.arrayBuffer());
    if (!magicOk(bytes, data.receipt.type)) throw new Error("Receipt file looks invalid. Please upload a PNG, JPG or PDF.");

    const ids = [...new Set(data.items.map((i) => i.productId))];
    const { data: products, error } = await supabaseAdmin.from("products").select("id,name,price,sale_price,price_thb,weight_kg,variants,categories(slug)").eq("is_active", true).in("id", ids);
    if (error) throw new Error(error.message);

    const lines = data.items.map((i) => {
      const p = products?.find((x) => x.id === i.productId);
      if (!p) throw new Error("A product in your cart is no longer available.");
      const sizes = ((p.variants as { sizes?: string[] })?.sizes ?? []);
      if (sizes.length && !sizes.includes(i.variant)) throw new Error(`Please choose a size for ${p.name}.`);
      if (data.country === "Thailand" && p.price_thb == null) throw new Error(`Thailand pricing is not available yet for ${p.name}.`);
      const unit = data.country === "Thailand" ? Number(p.price_thb) : effectivePrice({ price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price) });
      return { ...i, name: p.name, unit, weight_kg: p.weight_kg == null ? null : Number(p.weight_kg), category_slug: p.categories?.slug ?? "other-merch", variant: sizes.length ? i.variant : "" };
    });

    const subtotal = lines.reduce((s, l) => s + l.unit * l.quantity, 0);
    const ship = shippingFee(data.country, lines, data.state);
    if (ship == null) throw new Error("Thailand tumbler shipping requires a quote. Please contact Kopi Malay.");
    const currency = data.country === "Thailand" ? "thb" : "myr";
    let promoCode: string | null = null;
    let discount = 0;
    if (data.promoCode) {
      const promo = await loadPromo(supabaseAdmin, data.promoCode);
      const r = computePromoDiscount(promo, subtotal, currency);
      if (!r.ok) throw new Error(`Promo code: ${r.error}`);
      const { data: redeemed } = await supabaseAdmin.rpc("redeem_promo_code", { _code: promo!.code });
      if (!redeemed) throw new Error("Promo code: Invalid or expired promo code");
      promoCode = promo!.code.toUpperCase();
      discount = r.discount;
    }
    const total = subtotal - discount + ship;
    const token = crypto.randomUUID();
    const ext = data.receipt.type === "application/pdf" ? "pdf" : data.receipt.type === "image/png" ? "png" : "jpg";

    let order: { id: string; order_number: string } | null = null;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      const ref = attempt === 0 && data.ref && ORDER_REF_RE.test(data.ref) ? data.ref : makeOrderRef();
      const { data: o, error: oErr } = await supabaseAdmin.from("orders").insert({
        order_number: ref, user_id: userId, guest_email: data.email, currency,
        shipping_address: { name: data.name, phone: data.phone, address: data.address, city: data.city, state: data.state, postcode: data.postcode, country: data.country },
        subtotal, shipping_fee: ship, total_amount: total, promo_code: promoCode, discount_amount: discount,
        status: "pending_verification", payment_method: data.country === "Thailand" ? "PromptPay QR" : "DuitNow QR", access_token: token,
      }).select("id, order_number").single();
      if (o) order = o;
      else if (oErr && oErr.code !== "23505") throw new Error("Could not save your order. Please try again.");
    }
    if (!order) throw new Error("Could not create an order reference. Please try again.");

    const path = `${order.order_number}/${token}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from("payment-receipts").upload(path, bytes, { contentType: data.receipt.type });
    if (upErr) throw new Error("Could not upload your receipt. Please try again.");
    await supabaseAdmin.from("orders").update({ receipt_path: path }).eq("id", order.id);

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(lines.map((l) => ({
      order_id: order.id, product_id: l.productId, product_name: l.name, selected_variant: l.variant, unit_price: l.unit, quantity: l.quantity,
    })));
    if (itemsError) throw new Error("Could not save your order items. Please try again.");
    if (userId) await supabaseAdmin.from("cart_items").delete().eq("user_id", userId);

    try {
      const { data: signed } = await supabaseAdmin.storage.from("payment-receipts").createSignedUrl(path, 60 * 60 * 24 * 7);
      const url = signed?.signedUrl ?? "";
      const m = (v: number) => formatMoney(v, currency);
      const text = [
        `🛒 <b>New order: ${order.order_number}</b>`,
        `Status: Pending Verification`,
        ``,
        `👤 <b>${esc(data.name)}</b>`,
        `${esc(data.email)} · ${esc(data.phone)}`,
        ``,
        `📍 ${esc(data.address)}, ${esc(data.city)} ${data.postcode}, ${esc(data.state)}, ${data.country}`,
        ``,
        `📦 <b>Items</b>`,
        ...lines.map((l) => `• ${esc(l.name)}${l.variant ? ` (Size ${esc(l.variant)})` : ""} × ${l.quantity} — ${m(l.unit * l.quantity)}`),
        ``,
        ...(promoCode ? [`🎟️ Promo Code Applied: ${esc(promoCode)} (-${m(discount)})`] : []),
        `💰 Subtotal ${m(subtotal)}${discount ? ` − Discount ${m(discount)}` : ""} + Shipping ${m(ship)} = <b>${m(total)}</b>`,
        url ? `📄 <a href="${url}">View receipt</a> (link valid 7 days)` : `📄 Receipt saved (link unavailable)`,
      ].join("\n");
      await notifyTelegram(text, url, ext === "pdf");
    } catch (e) {
      console.error("Telegram notification failed", e);
    }

    return { ref: order.order_number, token };
  });

export type OrderSummary = {
  currency: string; order_number: string; status: string; created_at: string;
  subtotal: number; shipping_fee: number; total_amount: number; promo_code: string | null; discount_amount: number; email: string | null;
  shipping_address: { name?: string; phone?: string; address?: string; city?: string; state?: string; postcode?: string; country?: string };
  items: { product_name: string; selected_variant: string; unit_price: number; quantity: number }[];
};

export const getOrderByReference = createServerFn({ method: "GET" })
  .inputValidator((d: { ref: string; token: string }) => z.object({ ref: z.string().regex(ORDER_REF_RE), token: z.string().uuid() }).parse(d))
  .handler(async ({ data }): Promise<OrderSummary | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin.from("orders").select("*, order_items(*)").eq("order_number", data.ref).eq("access_token", data.token).maybeSingle();
    if (!order) return null;
    return {
      currency: order.currency, order_number: order.order_number, status: order.status, created_at: order.created_at,
      subtotal: Number(order.subtotal), shipping_fee: Number(order.shipping_fee), total_amount: Number(order.total_amount),
      promo_code: order.promo_code, discount_amount: Number(order.discount_amount ?? 0),
      email: order.guest_email, shipping_address: order.shipping_address as OrderSummary["shipping_address"],
      items: (order.order_items ?? []).map((i: { product_name: string; selected_variant: string; unit_price: number; quantity: number }) => ({
        product_name: i.product_name, selected_variant: i.selected_variant, unit_price: Number(i.unit_price), quantity: i.quantity,
      })),
    };
  });
