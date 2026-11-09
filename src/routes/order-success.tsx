import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Clock, MessageCircle } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { getOrderByReference } from "@/lib/checkout.functions";
import { formatMoney } from "@/lib/shop";
import { SUPPORT_TELEGRAM_URL } from "@/lib/manual-order";

export const Route = createFileRoute("/order-success")({
  validateSearch: (s: Record<string, unknown>): { ref?: string; t?: string } => ({
    ref: typeof s["ref"] === "string" ? s["ref"] : "",
    t: typeof s["t"] === "string" ? s["t"] : "",
  }),
  head: () => ({
    meta: [
      { title: "Order submitted — Kopi Malay x Route 1" },
      { name: "description", content: "Your Kopi Malay Route 1 order and payment proof were submitted for verification." },
      { property: "og:title", content: "Order submitted — Kopi Malay x Route 1" },
      { property: "og:description", content: "Payment proof submitted, pending verification." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OrderSuccess,
});

function OrderSuccess() {
  const { ref = "", t = "" } = Route.useSearch();
  const { clear } = useCart();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order-ref", ref, t],
    queryFn: () => getOrderByReference({ data: { ref, token: t } }),
    enabled: !!ref && !!t,
  });
  useEffect(() => { if (order) void clear(); }, [order, clear]);

  if (isLoading) return <p className="p-24 text-center text-muted-foreground">Loading your order…</p>;
  if (!order) return <div className="p-24 text-center"><p>We couldn't find that order.</p><Link to="/shop" className="text-primary underline">Back to shop</Link></div>;

  const a = order.shipping_address;
  const money = (v: number) => formatMoney(v, order.currency);
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">Order reference</p>
        <h1 className="font-display text-4xl font-bold">{order.order_number}</h1>
        <span className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-foreground">
          <Clock className="size-4" /> Payment Proof Submitted - Pending Admin Verification
        </span>
        <p className="mt-3 text-sm text-muted-foreground">We'll check your payment and confirm by email at {order.email}.</p>
      </div>
      <div className="mt-8 rounded-lg border bg-card p-5 text-sm">
        <p className="text-muted-foreground">Ship to</p>
        <p>{a.name}, {a.address}, {a.postcode} {a.city}, {a.state}, {a.country} · {a.phone}</p>
        <ul className="mt-5 divide-y border-y">
          {order.items.map((i, idx) => (
            <li key={idx} className="flex justify-between gap-3 py-2">
              <span>{i.product_name}{i.selected_variant && ` (Size ${i.selected_variant})`} × {i.quantity}</span>
              <span>{money(i.unit_price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-4 space-y-1">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
          {order.sticker_bundle_discount > 0 && <div className="flex justify-between text-primary"><dt>8×8cm sticker bundle savings</dt><dd>- {money(order.sticker_bundle_discount)}</dd></div>}
          {order.discount_amount > 0 && <div className="flex justify-between text-primary"><dt>Promo {order.promo_code}</dt><dd>- {money(order.discount_amount)}</dd></div>}
          <div className="flex justify-between"><dt>Shipping</dt><dd>{order.shipping_fee === 0 ? "Free" : money(order.shipping_fee)}</dd></div>
          <div className="flex justify-between font-display text-lg font-bold"><dt>Total payable</dt><dd>{money(order.total_amount)}</dd></div>
        </dl>
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a href={SUPPORT_TELEGRAM_URL} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border bg-card px-5 py-2.5 font-display font-semibold uppercase"><MessageCircle className="size-4" />Ask on Telegram</a>
        <Link to="/shop" className="rounded-md bg-ink px-5 py-2.5 font-display font-semibold uppercase text-ink-foreground">Keep shopping</Link>
      </div>
    </div>
  );
}
