import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import Stripe from "stripe";
import { effectivePrice, MY_STATES, shippingFee } from "./shop";

function stripe() {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Payments are not configured yet.");
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

const CheckoutInput = z.object({
  email: z.string().email().max(255),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().min(6).max(30),
  address: z.string().trim().min(3).max(300),
  city: z.string().trim().min(1).max(100),
  country: z.enum(["Malaysia", "Thailand"]),
  state: z.string().trim().min(1).max(100),
  postcode: z.string().regex(/^\d{5}$/),
  items: z.array(z.object({
    productId: z.string().uuid(),
    variant: z.string().max(20),
    quantity: z.number().int().min(1).max(50),
  })).min(1).max(50),
}).superRefine((data, ctx) => {
  if (data.country === "Malaysia" && !(MY_STATES as readonly string[]).includes(data.state)) {
    ctx.addIssue({ code: "custom", path: ["state"], message: "Please choose a Malaysian state." });
  }
});

export const createCheckoutSession = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof CheckoutInput>) => CheckoutInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const req = getRequest();
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;

    // Optional signed-in user
    let userId: string | null = null;
    const auth = req.headers.get("authorization");
    if (auth?.startsWith("Bearer ")) {
      const { data: u } = await supabaseAdmin.auth.getUser(auth.slice(7));
      userId = u.user?.id ?? null;
    }

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
    const ship = shippingFee(data.country, lines);
    if (ship == null) throw new Error("Thailand tumbler shipping requires configured unit weights and a total under 1kg. Please contact Kopi Malay for a shipping quote.");
    const currency = data.country === "Thailand" ? "thb" : "myr";
    const orderNumber = `KM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

    const { data: order, error: oErr } = await supabaseAdmin.from("orders").insert({
      order_number: orderNumber,
      user_id: userId,
      guest_email: data.email,
      currency,
      shipping_address: { name: data.name, phone: data.phone, address: data.address, city: data.city, state: data.state, postcode: data.postcode, country: data.country },
      subtotal, shipping_fee: ship, total_amount: subtotal + ship,
    }).select("id").single();
    if (oErr) throw new Error(oErr.message);

    const { error: itemsError } = await supabaseAdmin.from("order_items").insert(lines.map((l) => ({
      order_id: order.id, product_id: l.productId, product_name: l.name, selected_variant: l.variant, unit_price: l.unit, quantity: l.quantity,
    })));
    if (itemsError) throw new Error("Could not save your order items. Please try again.");

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      customer_email: data.email,
      line_items: lines.map((l) => ({
        quantity: l.quantity,
        price_data: {
          currency,
          unit_amount: Math.round(l.unit * 100),
          product_data: { name: l.variant ? `${l.name} (${l.variant})` : l.name },
        },
      })),
      shipping_options: [{
        shipping_rate_data: {
          type: "fixed_amount",
          display_name: data.country === "Thailand" ? (ship === 0 ? "Free Thailand shipping" : "Thailand tumbler shipping — under 1kg") : "Malaysia quantity-based shipping",
          fixed_amount: { amount: Math.round(ship * 100), currency },
        },
      }],
      metadata: { order_id: order.id },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout?cancelled=1`,
    });

    await supabaseAdmin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
    return { url: session.url };
  });

export type OrderSummary = {
  currency: string;
  order_number: string; status: string; created_at: string; transaction_id: string | null;
  subtotal: number; shipping_fee: number; total_amount: number; email: string | null;
  shipping_address: { name?: string; phone?: string; address?: string; city?: string; state?: string; postcode?: string; country?: string };
  items: { product_name: string; selected_variant: string; unit_price: number; quantity: number }[];
};

export const getOrderBySession = createServerFn({ method: "GET" })
  .inputValidator((d: { sessionId: string }) => z.object({ sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/) }).parse(d))
  .handler(async ({ data }): Promise<OrderSummary | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: order } = await supabaseAdmin.from("orders").select("*, order_items(*)").eq("stripe_session_id", data.sessionId).maybeSingle();
    if (!order) return null;

    let status = order.status;
    let pi = order.stripe_payment_intent_id;
    if (status !== "paid") {
      // Fallback in case the webhook hasn't arrived yet.
      const s = await stripe().checkout.sessions.retrieve(data.sessionId);
      if (s.payment_status === "paid") {
        status = "paid";
        pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
        await supabaseAdmin.from("orders").update({ status, stripe_payment_intent_id: pi }).eq("id", order.id);
        if (order.user_id) await supabaseAdmin.from("cart_items").delete().eq("user_id", order.user_id);
      }
    }
    return {
      currency: order.currency,
      order_number: order.order_number, status, created_at: order.created_at, transaction_id: pi,
      subtotal: Number(order.subtotal), shipping_fee: Number(order.shipping_fee), total_amount: Number(order.total_amount),
      email: order.guest_email, shipping_address: order.shipping_address as OrderSummary["shipping_address"],
      items: (order.order_items ?? []).map((i: { product_name: string; selected_variant: string; unit_price: number; quantity: number }) => ({
        product_name: i.product_name, selected_variant: i.selected_variant, unit_price: Number(i.unit_price), quantity: i.quantity,
      })),
    };
  });
