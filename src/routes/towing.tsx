import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { towingErrors, type TowingInput } from "@/lib/towing";
import { submitTowingRequest } from "@/lib/towing.functions";
import { THAI_REGIONS, townsForRegion } from "@/lib/thai-regions";
import { loadMyProfile } from "@/lib/profile";

export const Route = createFileRoute("/towing")({
  head: () => ({
    meta: [
      { title: "Towing & Rescue — Kopi Malay Route 1" },
      { name: "description", content: "Broken down on Route 1? Request motorcycle towing and rescue anywhere in Thailand." },
      { property: "og:title", content: "Motorcycle Towing & Rescue — Route 1" },
      { property: "og:description", content: "Stranded rider? Pick your region and request a tow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TowingPage,
});

type Text = Omit<TowingInput, "pickup_lat" | "pickup_lng" | "breakdown_location"> & { details: string };
const FIELDS: { key: keyof Text; label: string; placeholder: string; textarea?: boolean; type?: string }[] = [
  { key: "name", label: "Your name", placeholder: "Ahmad bin Ali" },
  { key: "phone", label: "Phone number", placeholder: "+60 12-345 6789", type: "tel" },
  { key: "plate_number", label: "Motorcycle plate number", placeholder: "WXY 1234" },
  { key: "motorcycle_model", label: "Motorcycle model", placeholder: "Honda CB500X" },
];
const field = "w-full rounded-md border bg-card px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring";

function TowingPage() {
  const submit = useServerFn(submitTowingRequest);
  const [form, setForm] = useState<Text>({ name: "", phone: "", plate_number: "", motorcycle_model: "", details: "", destination: "" });
  const [region, setRegion] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    loadMyProfile().then((p) => {
      if (!p) return;
      setForm((f) => ({
        ...f,
        name: f.name || p.full_name,
        phone: f.phone || p.phone,
        plate_number: f.plate_number || p.motorcycle_plate,
        motorcycle_model: f.motorcycle_model || [p.motorcycle_make, p.motorcycle_model].filter(Boolean).join(" "),
      }));
    });
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { details, ...rest } = form;
    const payload = { ...rest, breakdown_location: region && details ? `${details} (${region})` : "", pickup_lat: null, pickup_lng: null };
    const errs: Record<string, string> = { ...towingErrors(payload) };
    delete errs["breakdown_location"];
    if (!region) errs["region"] = "Please select your breakdown region.";
    else if (!details) errs["details"] = "Please select your town.";
    setErrors(errs);
    const order = ["name", "phone", "plate_number", "motorcycle_model", "region", "details", "destination"];
    const first = order.find((k) => errs[k]);
    if (first) { document.getElementById(`tow-${first}`)?.focus(); return; }
    setBusy(true);
    try {
      const r = await submit({ data: payload });
      setDone(r.reference);
      window.scrollTo({ top: 0 });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send request");
    } finally { setBusy(false); }
  };

  if (done) return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="font-display text-3xl font-bold uppercase">Request received</h1>
      <p className="mt-3 text-muted-foreground">Our team has been alerted and will call you shortly. Keep your phone nearby and stay safe.</p>
      <p className="mt-6 inline-block rounded-md border px-4 py-2 font-display text-xl font-bold">{done}</p>
    </div>
  );

  const err = (k: string) => errors[k] && <p className="text-sm text-destructive">{errors[k]}</p>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="font-display text-3xl font-bold uppercase md:text-4xl">Towing &amp; Rescue</h1>
      <p className="mt-2 text-muted-foreground">Broken down? Fill in the details and select your region. Fields marked * are required.</p>
      <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <label htmlFor={`tow-${f.key}`} className="text-sm font-medium">{f.label} *</label>
              <input id={`tow-${f.key}`} type={f.type ?? "text"} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} aria-invalid={!!errors[f.key]} className={`${field} ${errors[f.key] ? "border-destructive" : ""}`} />
              {err(f.key)}
            </div>
          ))}
          <div className="space-y-1.5">
            <label htmlFor="tow-region" className="text-sm font-medium">Breakdown region (Thailand) *</label>
            <select id="tow-region" value={region} onChange={(e) => { setRegion(e.target.value); setForm({ ...form, details: "" }); }} aria-invalid={!!errors["region"]} className={`${field} ${errors["region"] ? "border-destructive" : ""}`}>
              <option value="">Select region…</option>
              {THAI_REGIONS.map((g) => <option key={g.group} value={g.group}>{g.group}</option>)}
            </select>
            {err("region")}
          </div>
          <div className="space-y-1.5">
            <label htmlFor="tow-details" className="text-sm font-medium">Town *</label>
            <select id="tow-details" disabled={!region} value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} aria-invalid={!!errors["details"]} className={`${field} disabled:opacity-50 ${errors["details"] ? "border-destructive" : ""}`}>
              <option value="">{region ? "Select town…" : "Select a region first"}</option>
              {townsForRegion(region).map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {err("details")}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="tow-destination" className="text-sm font-medium">Towing destination address *</label>
            <textarea id="tow-destination" rows={2} value={form.destination} placeholder="Workshop / hotel address" onChange={(e) => setForm({ ...form, destination: e.target.value })} aria-invalid={!!errors["destination"]} className={`${field} ${errors["destination"] ? "border-destructive" : ""}`} />
            {err("destination")}
          </div>
        </div>
        <button disabled={busy} className="w-full rounded-md bg-primary py-3 font-display font-semibold uppercase text-primary-foreground hover:opacity-90 disabled:opacity-50">{busy ? "Sending…" : "Request towing"}</button>
      </form>
    </div>
  );
}
