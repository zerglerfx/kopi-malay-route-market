import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCart } from "@/hooks/use-cart";
import { useSuspenseQuery } from "@tanstack/react-query";
import { productsQuery } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import { submitManualOrder, validatePromoCode } from "@/lib/checkout.functions";
import { makeOrderRef, receiptError } from "@/lib/manual-order";
import { useNavigate } from "@tanstack/react-router";
import qrAsset from "@/assets/qr-touch-n-go.jpeg.asset.json";
import { destinationPrice, eastMalaysiaSurcharge, formatMoney, imageFor, MY_STATES, shippingFee, SINGAPORE_NOTICE, type Country } from "@/lib/shop";

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
  const create = useServerFn(submitManualOrder);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [receiptMsg, setReceiptMsg] = useState<string | null>(null);
  useEffect(() => { setRef(makeOrderRef()); }, []);
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
  const ship = shippingFee(country, lines.map((line) => ({ quantity: line.quantity, category_slug: line.product?.category_slug ?? "other-merch", weight_kg: line.product?.weight_kg ?? null })), f.state);
  const surcharge = eastMalaysiaSurcharge(country, f.state);
  const checkPromo = useServerFn(validatePromoCode);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number; label: string } | null>(null);
  const [promoErr, setPromoErr] = useState<string | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const discount = promo ? Math.min(promo.discount, subtotal) : 0;
  const payable = subtotal - discount + (ship ?? 0);
  const promoItemsKey = items.map((i) => `${i.productId}:${i.quantity}`).join(",");
  const applyPromo = async (code: string) => {
    if (!code.trim() || country === "Singapore") return;
    setPromoBusy(true); setPromoErr(null);
    try {
      const r = await checkPromo({ data: { code: code.trim(), country, items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })) } });
      if (r.ok) setPromo({ code: r.code, discount: r.discount, label: r.label });
      else { setPromo(null); setPromoErr(r.error); }
    } catch { setPromo(null); setPromoErr("Could not check this code. Please try again."); }
    setPromoBusy(false);
  };
  useEffect(() => { if (promo) void applyPromo(promo.code); }, [country, promoItemsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (cancelled) toast.warning("Payment was cancelled — your cart is still saved."); }, [cancelled]);
  useEffect(() => { const email = user?.email; if (email) setF((p) => (p.email ? p : { ...p, email })); }, [user]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (country === "Singapore") { toast.warning(SINGAPORE_NOTICE); return; }
    if (unavailable) { toast.warning("Some items are unavailable for this destination."); return; }
    if (ship == null) { toast.warning("Please contact Kopi Malay for a Thailand tumbler shipping quote."); return; }
    if (!f.state) { toast.warning("Please choose your state"); return; }
    const rErr = receiptError(receipt);
    if (rErr || !receipt) { setReceiptMsg(rErr); toast.warning(rErr ?? "Please upload your payment proof."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("payload", JSON.stringify({ ...f, country, ref, promoCode: promo?.code, items: items.map((i) => ({ productId: i.productId, variant: i.variant, quantity: i.quantity })) }));
      fd.append("receipt", receipt);
      const res = await create({ data: fd });
      await navigate({ to: "/order-success", search: { ref: res.ref, t: res.token } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit your order");
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
            <select aria-label="Country" value={country} onChange={(e) => { const value = e.target.value; setCountry(value === "Thailand" || value === "Singapore" ? value : "Malaysia"); setF((prev) => ({ ...prev, state: "" })); }} className={field}>
              <option>Malaysia</option><option>Thailand</option><option>Singapore</option>
            </select>
            {country === "Singapore" && <p role="alert" className="text-sm text-sale">{SINGAPORE_NOTICE}</p>}
            {lines.some((line) => line.product?.category_slug === "jerseys-t-shirts") && country === "Malaysia" && <p className="text-sm text-muted-foreground">Shipped from Tak, Thailand across the border via Peninsular Malaysia.</p>}
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
          {country !== "Singapore" && (
            <section className="space-y-4 rounded-lg border bg-card p-5">
              <h2 className="font-display text-lg font-semibold uppercase">Pay with DuitNow / Touch 'n Go QR</h2>
              <div className="grid gap-5 sm:grid-cols-[220px_1fr]">
                <img src={qrAsset.url} alt="Kopi Malay DuitNow / Touch 'n Go payment QR code" className="mx-auto w-full max-w-[220px] rounded-md border bg-background" />
                <div className="space-y-3 text-sm">
                  <div className="rounded-md border bg-background p-3">
                    <p className="text-muted-foreground">Amount to pay</p>
                    <p className="font-display text-2xl font-bold">{unavailable || ship == null ? "—" : money(payable)}</p>
                    <p className="mt-2 text-muted-foreground">Payment reference (put this in your transfer note)</p>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-xl font-bold">{ref || "…"}</span>
                      <button type="button" onClick={() => { void navigator.clipboard?.writeText(ref); toast.success("Reference copied"); }} className="rounded border px-2 py-1 text-xs">Copy</button>
                    </div>
                  </div>
                  <p><strong>Malaysia:</strong> Scan with Touch 'n Go eWallet or any Malaysian mobile banking app (DuitNow QR).</p>
                  <p><strong>Thailand / ประเทศไทย:</strong> Scan with any major Thai bank app (SCB, K-Bank, Krungthai) via cross-border PromptPay / DuitNow QR. สแกนผ่านแอปธนาคารไทย (PromptPay ข้ามประเทศ)</p>
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className="font-medium">Upload payment proof / receipt *</span>
                <input required type="file" accept="image/png,image/jpeg,application/pdf" onChange={(e) => { const file = e.target.files?.[0] ?? null; setReceipt(file); setReceiptMsg(file ? receiptError(file) : null); }} className={field} />
                <span className="block text-xs text-muted-foreground">PNG, JPG or PDF, up to 5MB.</span>
                {receipt && !receiptMsg && <span className="block text-xs">Selected: {receipt.name}</span>}
                {receiptMsg && <span role="alert" className="block text-sm text-sale">{receiptMsg}</span>}
              </label>
            </section>
          )}
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
            <div className="mb-3 space-y-2">
              <label htmlFor="promo" className="font-medium">Promo Code / Discount</label>
              {promo ? (
                <div className="flex items-center justify-between rounded-md border border-primary bg-primary/10 px-3 py-2">
                  <span className="font-display font-semibold text-primary">✓ {promo.code} applied</span>
                  <button type="button" onClick={() => { setPromo(null); setPromoInput(""); }} className="text-xs underline">Remove</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input id="promo" value={promoInput} onChange={(e) => setPromoInput(e.target.value.toUpperCase())} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void applyPromo(promoInput); } }} placeholder="Enter code" className={field} />
                  <Button type="button" variant="outline" disabled={promoBusy || !promoInput.trim() || country === "Singapore"} onClick={() => void applyPromo(promoInput)}>{promoBusy ? "…" : "Apply"}</Button>
                </div>
              )}
              {promoErr && <p role="alert" className="text-sm text-sale">{promoErr}</p>}
            </div>
            <div className="flex justify-between"><dt>Subtotal</dt><dd>{unavailable ? "—" : money(subtotal)}</dd></div>
            {promo && discount > 0 && <div className="flex justify-between text-primary"><dt>Discount ({promo.code}{promo.label ? ` · ${promo.label}` : ""})</dt><dd>- {money(discount)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{ship == null ? "Quote required" : ship === 0 ? "Free" : money(ship)}</dd></div>
            {surcharge > 0 && <div className="flex justify-between text-muted-foreground"><dt>Includes Sabah / Sarawak surcharge</dt><dd>{money(surcharge)}</dd></div>}
            <div className="flex justify-between pt-2 font-display text-lg font-bold"><dt>Total</dt><dd>{unavailable || ship == null ? "—" : money(payable)}</dd></div>
          </dl>
          {unavailable && country !== "Singapore" && <p role="alert" className="mt-3 text-sm text-sale">Some items have no price for {country} or are no longer available. Remove them or choose another destination.</p>}
          {ship == null && country !== "Singapore" && <p role="alert" className="mt-3 text-sm text-sale">Thailand tumbler shipping needs confirmed unit weights and a total under 1kg. Please contact Kopi Malay for a shipping quote.</p>}
          <Button type="submit" disabled={busy || unavailable || ship == null || country === "Singapore"} className="mt-5 h-auto w-full py-3 font-display font-semibold uppercase">
            {busy ? "Submitting…" : "Confirm Order & Submit Receipt"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">Thailand: apparel and accessories free; tumblers THB 60 under 1kg. Malaysia: RM 20 per 2 tumblers, RM 20 per 2 apparel items, and RM 20 per 20 accessories. Each group is charged separately. Sabah & Sarawak: add RM 10 per order.</p>
        </aside>
      </form>
    </div>
  );
}
