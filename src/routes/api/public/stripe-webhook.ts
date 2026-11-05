import { createFileRoute } from "@tanstack/react-router";
import Stripe from "stripe";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["STRIPE_SECRET_KEY"];
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        const sig = request.headers.get("stripe-signature");
        if (!key || !secret || !sig) return new Response("Not configured", { status: 400 });

        const stripe = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
        const body = await request.text();
        let event: Stripe.Event;
        try {
          event = await stripe.webhooks.constructEventAsync(body, sig, secret, undefined, Stripe.createSubtleCryptoProvider());
        } catch {
          return new Response("Invalid signature", { status: 400 });
        }

        if (event.type === "checkout.session.completed") {
          const s = event.data.object as Stripe.Checkout.Session;
          const orderId = s.metadata?.order_id;
          if (orderId && s.payment_status === "paid") {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
            const { data: order } = await supabaseAdmin
              .from("orders").update({ status: "paid", stripe_payment_intent_id: pi, stripe_session_id: s.id })
              .eq("id", orderId).select("user_id").maybeSingle();
            if (order?.user_id) await supabaseAdmin.from("cart_items").delete().eq("user_id", order.user_id);
          }
        }
        return Response.json({ received: true });
      },
    },
  },
});
