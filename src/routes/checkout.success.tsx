import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { CheckCircle2, Printer } from "lucide-react";
import { useCart } from "@/hooks/use-cart";
import { getOrderBySession } from "@/lib/checkout.functions";
import { deliveryEstimate, formatRM } from "@/lib/shop";

export const Route = createFileRoute("/checkout/success")({
  validateSearch: (s: Record<string, unknown>) => ({ session_id: typeof s.session_id === "string" ? s.session_id : "" }),
  head: () => ({
    meta: [
      { title: "Order confirmed — Kopi Malay Route 1" },
      { name: "description", content: "Your Kopi Malay Route 1 order confirmation and receipt." },
      { property: "og:title", content: "Order confirmed — Kopi Malay Route 1" },
      { property: "og:description", content: "Your Kopi Malay Route 1 order confirmation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Success,
});

function Success() {
  const { session_id } = Route.useSearch();
  const { clear } = useCart();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", session_id],
    queryFn: () => getOrderBySession({ data: { sessionId: session_id } }),
    enabled: !!session_id,
  });

  useEffect(() => {
    if (order?.status === "paid") { void clear(); toast.success("Payment successful!"); }
  }, [order?.status, clear]);

  if (isLoading) return <p className="p-24 text-center text-muted-foreground">Loading your order…</p>;
  if (!order) return (
    <div className="p-24 text-center"><p>We couldn't find that order.</p><Link to="/shop" className="text-primary underline">Back to shop</Link></div>
  );

  const a = order.shipping_address;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="text-center">
        <CheckCircle2 className="mx-auto size-14 text-primary" />
        <h1 className="mt-3 font-display text-3xl font-bold uppercase">{order.status === "paid" ? "Thank you!" : "Payment processing"}</h1>
        <p className="mt-2 text-muted-foreground">A receipt has been sent by Stripe to {order.email}.</p>
      </div>
      <div className="mt-8 rounded-lg border bg-card p-6">
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div><p className="text-muted-foreground">Order number</p><p className="font-display font-semibold">{order.order_number}</p></div>
          <div><p className="text-muted-foreground">Transaction ID</p><p className="break-all font-mono text-xs">{order.transaction_id ?? "Pending"}</p></div>
          <div><p className="text-muted-foreground">Date</p><p>{new Date(order.created_at).toLocaleString("en-MY")}</p></div>
          <div><p className="text-muted-foreground">Estimated delivery</p><p>{deliveryEstimate(a.state ?? "")}</p></div>
          <div className="sm:col-span-2"><p className="text-muted-foreground">Ship to</p><p>{a.name}, {a.address}, {a.postcode} {a.city}, {a.state} · {a.phone}</p></div>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Item</th><th>Qty</th><th className="text-right">Total</th></tr></thead>
          <tbody>
            {order.items.map((i, idx) => (
              <tr key={idx} className="border-b"><td className="py-2">{i.product_name}{i.selected_variant && ` (${i.selected_variant})`}</td><td>{i.quantity}</td><td className="text-right">{formatRM(i.unit_price * i.quantity)}</td></tr>
            ))}
          </tbody>
        </table>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatRM(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt>Shipping</dt><dd>{formatRM(order.shipping_fee)}</dd></div>
          <div className="flex justify-between font-display text-lg font-bold"><dt>Total paid</dt><dd>{formatRM(order.total_amount)}</dd></div>
        </dl>
      </div>
      <div className="no-print mt-6 flex justify-center gap-3">
        <button onClick={() => window.print()} className="flex items-center gap-2 rounded-md border bg-card px-5 py-2.5 font-display font-semibold uppercase"><Printer className="size-4" />Print receipt</button>
        <Link to="/shop" className="rounded-md bg-ink px-5 py-2.5 font-display font-semibold uppercase text-ink-foreground">Keep shopping</Link>
      </div>
    </div>
  );
}
