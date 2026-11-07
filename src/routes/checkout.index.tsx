import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/hooks/use-cart";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/lib/checkout.functions";
import { destinationPrice, formatMoney, imageFor, MY_STATES, shippingFee, type Country } from "@/lib/shop";

export const Route = createFileRoute("/checkout/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(productsQuery),
  validateSearch: (s: Record<string, unknown>): { cancelled?: number | undefined } => (s["cancelled"] ? { cancelled: 1 } : {}),
  head: () => ({
    meta: [
      { title: "Checkout — Kopi Malay Route 1" },
      { name: "description", content: "Secure checkout for Kopi Malay Route 1 merchandise." },
      { property: "og:title", content: "Checkout — Kopi Malay Route 1" },
      { property: "og:description", content: "Secure checkout for Kopi Malay Route 1 merchandise." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Checkout,
});

const field = "w-full rounded-md border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring";

function Checkout() {
  const { items, user } = useCart();
  const { data: products } = useSuspenseQuery(productsQuery);
  const { cancelled } = Route.useSearch();
  const create = useServerFn(createCheckoutSession);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ email: "", name: "", phone: "", address: "", city: "", state: "", postcode: "" });
  const [country, setCountry] = useState<Country>("Malaysia");
  const currency = country === "Thailand" ? "thb" : "myr";
  const money = (value: number) => formatMoney(value, currency);
  const lines = items.map((item) => {
    const product = products.find((p) => p.id === item.productId);
    return { ...item, product, price: product ? destinationPrice(product, country) : null };
  });
  const unavailable = lines.some((line) => line.price == null);
  const subtotal = lines.reduce((sum, line) => sum + (line.price ?? 0) * line.quantity, 0);
  const ship = shippingFee(country, lines.map((line) => ({ quantity: line.quantity, category_slug: line.product?.category_slug ?? "other-merch" })));

  useEffect(() => { if (cancelled) toast.warning("Payment was cancelled — your cart is still saved."); }, [cancelled]);
  useEffect(() => { const email = user?.email; if (email) setF((p) => (p.email ? p : { ...p, email })); }, [user]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (unavailable) { toast.warning("Some items are unavailable for this destination."); return; }
    if (!f.state) { toast.warning("Please choose your state"); return; }
    setBusy(true);
    try {
      const res = await create({ data: { ...f, country, items: items.map((i) => ({ productId: i.productId, variant: i.variant, quantity: i.quantity })) } });
      if (res.url) window.location.href = res.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start payment");
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold uppercase">Your cart is empty</h1>
        <Link to="/shop" className="mt-6 inline-block rounded-md bg-ink px-6 py-3 font-display font-semibold uppercase text-ink-foreground">Shop merch</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="font-display text-3xl font-bold uppercase md:text-4xl">Checkout</h1>
      <form onSubmit={submit} className="mt-6 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold uppercase">Contact</h2>
            <input required type="email" placeholder="Email" value={f.email} onChange={set("email")} className={field} />
            <input required placeholder="Phone (e.g. 012-345 6789)" value={f.phone} onChange={set("phone")} className={field} />
            {!user && <p className="text-sm text-muted-foreground">Have an account? <Link to="/auth" className="text-primary underline">Log in</Link> to save your cart.</p>}
          </section>
          <section className="space-y-3">
            <h2 className="font-display text-lg font-semibold uppercase">Shipping address</h2>
            <select aria-label="Country" value={country} onChange={(e) => { setCountry(e.target.value === "Thailand" ? "Thailand" : "Malaysia"); setF((prev) => ({ ...prev, state: "" })); }} className={field}>
              <option>Malaysia</option><option>Thailand</option>
            </select>
            <input required placeholder="Full name" value={f.name} onChange={set("name")} className={field} />
            <input required placeholder="Address" value={f.address} onChange={set("address")} className={field} />
            <div className="grid gap-3 sm:grid-cols-3">
              <input required placeholder="City" value={f.city} onChange={set("city")} className={field} />
              {country === "Malaysia" ? <select required value={f.state} onChange={set("state")} className={field} aria-label="State">
                <option value="">State</option>
                {MY_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select> : <input required aria-label="Province" placeholder="Province" value={f.state} onChange={set("state")} className={field} />}
              <input required placeholder="Postcode" pattern="\d{5}" inputMode="numeric" value={f.postcode} onChange={set("postcode")} className={field} />
            </div>
          </section>
        </div>
        <aside className="h-fit rounded-lg border bg-card p-5">
          <h2 className="font-display text-lg font-semibold uppercase">Order summary</h2>
          <ul className="mt-4 space-y-3">
            {lines.map((i) => (
              <li key={i.productId + i.variant} className="flex gap-3 text-sm">
                <img src={imageFor(i.product?.images[0] ?? i.image)} alt="" className="size-14 rounded border object-contain" />
                <div className="flex-1"><p className="font-medium">{i.name}</p><p className="text-muted-foreground">{i.variant && `${i.variant} · `}Qty {i.quantity}</p></div>
                <span>{i.price == null ? "Unavailable" : money(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 space-y-1 border-t pt-4 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{unavailable ? "—" : money(subtotal)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{ship === 0 ? "Free" : money(ship)}</dd></div>
            <div className="flex justify-between pt-2 font-display text-lg font-bold"><dt>Total</dt><dd>{unavailable ? "—" : money(subtotal + ship)}</dd></div>
          </dl>
          {unavailable && <p role="alert" className="mt-3 text-sm text-sale">Some items have no price for {country} or are no longer available. Remove them or choose another destination.</p>}
          <Button type="submit" disabled={busy || unavailable} className="mt-5 h-auto w-full py-3 font-display font-semibold uppercase">
            {busy ? "Redirecting…" : "Pay with Stripe"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Thailand: free. Malaysia: RM 20 per 2 tumblers, RM 20 per 2 apparel items, and RM 20 per 10 accessories. Each group is charged separately.</p>
        </aside>
      </form>
    </div>
  );
}
