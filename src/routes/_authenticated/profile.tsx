import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { customerStatus } from "@/lib/order-flow";
import { formatMoney } from "@/lib/shop";
import { CONTACT_OPTIONS, EMPTY_PROFILE, loadMyProfile, type Profile } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Kopi Malay Route 1" },
      { name: "description", content: "Manage your Kopi Malay member details, delivery address and motorcycle garage." },
      { property: "og:title", content: "My Profile — Kopi Malay Route 1" },
      { property: "og:description", content: "Member profile, delivery address and motorcycle details." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

const field = "w-full rounded-md border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring";

function ProfilePage() {
  const [p, setP] = useState<Profile>(EMPTY_PROFILE);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [orders, setOrders] = useState<{ id: string; order_number: string; created_at: string; status: string; currency: string; total_amount: number }[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
    loadMyProfile().then((r) => { if (r) setP(r); setLoading(false); });
    supabase.from("orders").select("id,order_number,created_at,status,currency,total_amount").order("created_at", { ascending: false }).limit(50)
      .then(({ data }) => setOrders((data ?? []).map((o) => ({ ...o, total_amount: Number(o.total_amount) }))));
  }, []);

  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setP({ ...p, [k]: e.target.value });
  const input = (k: keyof Profile, label: string, placeholder = "", type = "text") => (
    <div className="space-y-1.5">
      <label htmlFor={`pf-${k}`} className="text-sm font-medium">{label}</label>
      <input id={`pf-${k}`} type={type} value={p[k]} placeholder={placeholder} maxLength={200} onChange={set(k)} className={field} />
    </div>
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(true);
    const trimmed = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v.trim()])) as Profile;
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...trimmed, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  if (loading) return <p className="mx-auto max-w-3xl px-4 py-10 text-muted-foreground">Loading…</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold uppercase md:text-4xl">My Profile</h1>
      <p className="mt-2 text-muted-foreground">Signed in as {email}. These details pre-fill checkout and towing requests.</p>
      <form onSubmit={save} className="mt-6 space-y-8">
        <section className="space-y-4 rounded-lg border p-5">
          <h2 className="font-display text-lg font-bold uppercase">Personal &amp; contact</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("full_name", "Full name", "Ahmad bin Ali")}
            {input("phone", "Phone number", "+60 12-345 6789", "tel")}
            <div className="space-y-1.5">
              <label htmlFor="pf-preferred_contact" className="text-sm font-medium">Preferred contact</label>
              <select id="pf-preferred_contact" value={p.preferred_contact} onChange={set("preferred_contact")} className={field}>
                {CONTACT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {input("contact_handle", "Contact handle (optional)", "@telegram or alternate number")}
          </div>
        </section>
        <section className="space-y-4 rounded-lg border p-5">
          <h2 className="font-display text-lg font-bold uppercase">Default delivery address</h2>
          <div className="space-y-1.5">
            <label htmlFor="pf-address" className="text-sm font-medium">Address</label>
            <textarea id="pf-address" rows={2} value={p.address} maxLength={300} onChange={set("address")} className={field} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {input("city", "City")}
            {input("state", "State / Province")}
            {input("postcode", "Postcode")}
            <div className="space-y-1.5">
              <label htmlFor="pf-country" className="text-sm font-medium">Country</label>
              <select id="pf-country" value={p.country} onChange={set("country")} className={field}>
                <option value="malaysia">Malaysia</option>
                <option value="thailand">Thailand</option>
              </select>
            </div>
          </div>
        </section>
        <section className="space-y-4 rounded-lg border p-5">
          <h2 className="font-display text-lg font-bold uppercase">Motorcycle garage</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {input("motorcycle_make", "Make", "Honda")}
            {input("motorcycle_model", "Model", "CB500X")}
            {input("motorcycle_plate", "Plate number", "WXY 1234")}
          </div>
        </section>
        <button disabled={busy} className="w-full rounded-md bg-primary py-3 font-display font-semibold uppercase text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? "Saving…" : "Save profile"}</button>
      </form>
      <section className="mt-8 space-y-3 rounded-lg border p-5">
        <h2 className="font-display text-lg font-bold uppercase">My orders</h2>
        {!orders.length ? <p className="text-sm text-muted-foreground">No orders yet.</p> : (
          <ul className="divide-y">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span><span className="font-mono font-semibold">{o.order_number}</span> <span className="text-muted-foreground">· {new Date(o.created_at).toLocaleDateString()}</span></span>
                <span className="flex items-center gap-3">
                  <span className={`rounded-full px-3 py-0.5 text-xs font-semibold ${o.status === "refunded" ? "border border-foreground" : "bg-accent text-accent-foreground"}`}>{customerStatus(o.status)}</span>
                  <span className="tabular-nums">{formatMoney(o.total_amount, o.currency)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
